"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Personality } from "../lib/types";
import { Bud } from "./Botanicals";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  persona: Personality;
  suggestions: string[];
  onSuggestion: (text: string) => void;
}

const MAX = 4000;

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  persona,
  suggestions,
  onSuggestion,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the content, up to a ceiling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // "auto" first — measuring against a fixed height returns a stale scrollHeight.
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  };

  const canSend = !busy && value.trim().length > 0;

  return (
    <div className="relative z-10 px-4 pb-5 pt-2 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        {suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => onSuggestion(text)}
                disabled={busy}
                className="rounded-full border bg-[var(--paper-card)]/80 px-3.5 py-1.5 text-[12.5px] text-ink-soft backdrop-blur transition-all hover:-translate-y-px hover:text-[var(--accent-deep)] disabled:opacity-40"
                style={{ borderColor: "color-mix(in srgb, var(--accent) 26%, transparent)" }}
              >
                {text}
              </button>
            ))}
          </div>
        )}

        <div
          className="relative flex items-end gap-2 rounded-[26px] border px-3 py-2.5 shadow-[var(--shadow-lift)] backdrop-blur"
          style={{
            background: "color-mix(in srgb, var(--paper-card) 92%, transparent)",
            borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
          }}
        >
          <Bud className="pointer-events-none absolute -left-5 bottom-1 hidden h-16 w-9 text-[var(--accent)] opacity-30 sm:block" />
          <Bud className="pointer-events-none absolute -right-5 bottom-1 hidden h-16 w-9 -scale-x-100 text-[var(--accent)] opacity-30 sm:block" />

          <textarea
            ref={ref}
            rows={1}
            value={value}
            maxLength={MAX}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={keyDown}
            placeholder={`Say something to ${persona.name}…`}
            aria-label={`Message ${persona.name}`}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          />

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform hover:scale-105"
              style={{ borderColor: "var(--accent)", color: "var(--accent-deep)" }}
            >
              <span className="block h-3 w-3 rounded-[3px]" style={{ background: "var(--accent)" }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send message"
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all enabled:hover:scale-105 enabled:hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-35"
              style={{
                background: "var(--accent)",
                boxShadow: canSend ? "0 8px 22px -10px var(--accent)" : undefined,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                <path
                  d="M4.6 11.9 19 5.2c.6-.3 1.2.3.9.9l-6.6 14.4c-.3.6-1.1.5-1.3-.1l-1.7-5.6a1 1 0 0 0-.6-.6l-5.6-1.7c-.6-.2-.7-1 0-1.3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-ink-faint">
          <span>
            <kbd className="font-medium">Enter</kbd> to send · <kbd className="font-medium">Shift</kbd>+
            <kbd className="font-medium">Enter</kbd> for a new line
          </span>
          <span className={value.length > MAX - 200 ? "text-[var(--accent-deep)]" : ""}>
            {value.length > 0 ? `${value.length}/${MAX}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
