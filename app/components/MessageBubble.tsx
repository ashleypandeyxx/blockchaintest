"use client";

import { useState } from "react";
import type { Message, Personality } from "../lib/types";
import { Markdown } from "./Markdown";
import { MotifBadge } from "./Botanicals";

function Avatar({ persona }: { persona: Personality }) {
  return (
    <MotifBadge
      name={persona.motif}
      className="mt-0.5 h-10 w-10 text-[var(--accent-deep)]"
      fill="var(--bubble)"
      ring="color-mix(in srgb, var(--accent) 45%, transparent)"
    />
  );
}

interface Props {
  message: Message;
  persona: Personality;
  streaming?: boolean;
  onRetry?: () => void;
}

export function MessageBubble({ message, persona, streaming, onRetry }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  // Each turn keeps the palette of whoever it was written by or to, so history
  // stays legible after you switch personas.
  const authored = {
    "--accent": persona.theme.primary,
    "--accent-soft": persona.theme.soft,
    "--accent-deep": persona.theme.deep,
    "--bubble": persona.theme.bubble,
  } as React.CSSProperties;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing useful to say */
    }
  };

  if (isUser) {
    return (
      <div className="bloom-in group flex justify-end gap-3 px-1" style={authored}>
        <div className="flex max-w-[min(38rem,84%)] flex-col items-end gap-1.5">
          <div
            className="rounded-[22px] rounded-br-[6px] px-4 py-3 text-[15px] leading-relaxed text-white shadow-[var(--shadow-petal)]"
            style={{ background: "var(--accent)" }}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <button
            type="button"
            onClick={copy}
            className="eyebrow opacity-0 transition-opacity hover:text-[var(--accent-deep)] group-hover:opacity-100 focus-visible:opacity-100"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bloom-in group flex gap-3 px-1" style={authored}>
      <Avatar persona={persona} />
      <div className="flex min-w-0 max-w-[min(42rem,88%)] flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="display text-[15px] font-semibold text-ink">{persona.name}</span>
          <span className="text-[11px] text-ink-faint">{persona.handle}</span>
        </div>

        <div
          className="rounded-[22px] rounded-tl-[6px] border px-4 py-3 text-[15px] text-ink shadow-[var(--shadow-petal)]"
          style={{
            background: "var(--paper-card)",
            borderColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
          }}
        >
          {message.error ? (
            <div className="space-y-2">
              <p className="text-[14px] leading-relaxed text-[var(--accent-deep)]">{message.error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-full border px-3 py-1 text-[12px] transition-colors hover:bg-[var(--accent-soft)]"
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <div className="reply break-words">
              <Markdown text={message.content} />
              {streaming && (
                <span
                  className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full"
                  style={{ background: "var(--accent)", animation: "soft-pulse 1s ease-in-out infinite" }}
                />
              )}
            </div>
          )}
        </div>

        {!streaming && !message.error && message.content.trim() && (
          <div className="flex gap-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={copy} className="eyebrow hover:text-[var(--accent-deep)]">
              {copied ? "copied" : "copy"}
            </button>
            {onRetry && (
              <button type="button" onClick={onRetry} className="eyebrow hover:text-[var(--accent-deep)]">
                regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Shown between the send and the first token. */
export function TypingRow({ persona }: { persona: Personality }) {
  return (
    <div className="bloom-in flex gap-3 px-1">
      <Avatar persona={persona} />
      <div
        className="flex items-center gap-2.5 self-start rounded-[22px] rounded-tl-[6px] border px-4 py-3.5"
        style={{
          background: "var(--paper-card)",
          borderColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
        }}
      >
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--accent)",
                animation: `soft-pulse 1.1s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </span>
        <span className="text-[12px] italic text-ink-faint">{persona.typingLabel}…</span>
      </div>
    </div>
  );
}
