import Anthropic from "@anthropic-ai/sdk";
import { HOUSE_RULES } from "../../lib/personalities";

/** Streaming needs a live request — never prerender this. */
export const dynamic = "force-dynamic";

const MODEL = process.env.GLIMMER_MODEL || "claude-sonnet-5";
const MAX_TOKENS = 4096;
/** How many prior turns we replay. Keeps latency and spend predictable. */
const MAX_HISTORY = 40;
const MAX_CHARS_PER_MESSAGE = 12_000;

interface ChatRequestBody {
  messages?: { role?: string; content?: string }[];
  systemPrompt?: string;
  personaName?: string;
  /** Set when the user swapped personas mid-conversation. */
  switchedFrom?: string;
}

function sse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** One-shot error response in the same SSE shape the client already parses. */
function sseError(message: string, status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sse({ type: "error", message }));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return sseError(
      "No API key found. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return sseError("That request didn't parse. Try sending again.");
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = incoming
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CHARS_PER_MESSAGE),
    }));

  // The API requires the first turn to be from the user.
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();

  if (messages.length === 0) {
    return sseError("There was nothing to send.");
  }

  const persona =
    typeof body.systemPrompt === "string" && body.systemPrompt.trim()
      ? body.systemPrompt.trim().slice(0, 8_000)
      : "You are a warm, helpful assistant.";

  const handover = body.switchedFrom
    ? `\n\nContext: the user was just talking to ${String(body.switchedFrom).slice(0, 60)} and has switched to you mid-conversation. Acknowledge the handover in one short line, in your own voice, then carry on with what they actually need.`
    : "";

  const client = new Anthropic({ apiKey });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      try {
        const run = client.messages.stream(
          {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: `${HOUSE_RULES}\n\n---\n\n${persona}${handover}`,
            // Chat needs to feel instant, so reasoning stays off here.
            thinking: { type: "disabled" },
            messages,
          },
          { signal: request.signal },
        );

        for await (const event of run) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(sse({ type: "delta", text: event.delta.text }));
          }
        }

        const final = await run.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            sse({
              type: "error",
              message:
                "I can't help with that one. Try asking a different way, or pick another persona.",
            }),
          );
        } else {
          controller.enqueue(
            sse({ type: "done", stopReason: final.stop_reason }),
          );
        }
        close();
      } catch (error) {
        // A client-side stop() aborts the fetch; that isn't a failure worth reporting.
        if (request.signal.aborted) {
          close();
          return;
        }

        let message = "Something went wrong reaching Claude. Try again?";
        if (error instanceof Anthropic.AuthenticationError) {
          message =
            "That API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
        } else if (error instanceof Anthropic.RateLimitError) {
          message = "Rate limited — give it a few seconds and send again.";
        } else if (error instanceof Anthropic.BadRequestError) {
          message = `The request was rejected: ${error.message}`;
        } else if (error instanceof Anthropic.APIConnectionError) {
          message = "Couldn't reach the API. Check your connection.";
        } else if (error instanceof Anthropic.APIError) {
          message = `API error ${error.status}: ${error.message}`;
        }

        controller.enqueue(sse({ type: "error", message }));
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
