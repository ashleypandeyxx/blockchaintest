"use client";

import type { Message } from "./types";

interface StreamArgs {
  messages: Pick<Message, "role" | "content">[];
  systemPrompt: string;
  personaName: string;
  switchedFrom?: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
}

/**
 * POSTs to /api/chat and reads the SSE body, calling onDelta per chunk.
 * Resolves when the turn ends; rejects with a user-readable message on failure.
 */
export async function streamReply({
  messages,
  systemPrompt,
  personaName,
  switchedFrom,
  signal,
  onDelta,
}: StreamArgs): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
      systemPrompt,
      personaName,
      switchedFrom,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `The server responded ${response.status}. Is the dev server still running?`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failure: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;

      try {
        const payload = JSON.parse(line.slice(5).trim()) as {
          type: string;
          text?: string;
          message?: string;
        };
        if (payload.type === "delta" && payload.text) onDelta(payload.text);
        else if (payload.type === "error")
          failure = payload.message ?? "Something went wrong.";
      } catch {
        /* ignore a malformed frame rather than killing the stream */
      }
    }
  }

  if (failure) throw new Error(failure);
}
