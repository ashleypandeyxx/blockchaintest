"use client";

import { useEffect, useRef, useState } from "react";
import type { Conversation, Personality } from "../lib/types";
import { MessageBubble, TypingRow } from "./MessageBubble";
import { Motif, MotifBadge, VineRule, Wreath, LeafStem } from "./Botanicals";

interface Props {
  conversation: Conversation | null;
  persona: Personality;
  personaFor: (id: string) => Personality;
  streamingId: string | null;
  waiting: boolean;
  onRetry: () => void;
  onOpenSidebar: () => void;
  onOpenStudio: () => void;
  onRename: (title: string) => void;
}

export function ChatWindow({
  conversation,
  persona,
  personaFor,
  streamingId,
  waiting,
  onRetry,
  onOpenSidebar,
  onOpenStudio,
  onRename,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const messages = conversation?.messages ?? [];
  const lastId = messages.length ? messages[messages.length - 1].id : "";

  // Follow the stream only while the reader is already at the bottom.
  useEffect(() => {
    if (!pinned) return;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
  };

  const commitTitle = () => {
    setEditing(false);
    const next = draftTitle.trim();
    if (next) onRename(next);
  };

  const empty = messages.length === 0;

  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="relative flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md sm:px-8"
        style={{
          borderColor: "var(--line)",
          background: "color-mix(in srgb, var(--paper) 82%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-[var(--accent-soft)] lg:hidden"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
          </svg>
        </button>

        <MotifBadge
          name={persona.motif}
          className="h-11 w-11 text-[var(--accent-deep)]"
          fill="var(--bubble)"
          ring="color-mix(in srgb, var(--accent) 45%, transparent)"
        />

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitTitle();
                if (event.key === "Escape") setEditing(false);
              }}
              className="display w-full truncate bg-transparent text-[17px] font-semibold outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!conversation) return;
                setDraftTitle(conversation.title);
                setEditing(true);
              }}
              className="display block max-w-full truncate text-left text-[17px] font-semibold leading-tight hover:opacity-70"
              title="Rename this conversation"
            >
              {conversation?.title ?? "New conversation"}
            </button>
          )}
          <p className="truncate text-[12px] text-ink-faint">
            with {persona.name} — <span className="italic">{persona.tagline}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenStudio}
          className="hidden shrink-0 rounded-full border px-4 py-2 text-[12.5px] transition-colors hover:bg-[var(--accent-soft)] sm:block"
          style={{ borderColor: "var(--line-strong)", color: "var(--accent-deep)" }}
        >
          Personality Studio
        </button>
      </header>

      {/* ── Messages ───────────────────────────────────────── */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="pretty-scroll relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {empty ? (
            <div className="relative flex flex-col items-center px-4 pb-6 pt-8 text-center sm:pt-14">
              <LeafStem className="absolute left-0 top-10 hidden h-40 w-16 text-[var(--accent)] opacity-25 md:block" />
              <LeafStem className="absolute right-0 top-10 hidden h-40 w-16 -scale-x-100 text-[var(--accent)] opacity-25 md:block" />

              <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
                <Wreath className="stem-draw absolute inset-0 h-full w-full text-[var(--accent)] opacity-55" />
                <Motif
                  name={persona.motif}
                  className="h-14 w-14 text-[var(--accent-deep)] sm:h-16 sm:w-16"
                  strokeWidth={1}
                />
              </div>

              <h2 className="display mt-5 text-[24px] font-semibold leading-none sm:text-[27px]">
                {persona.name}
              </h2>
              <p className="eyebrow mt-2">{persona.tagline}</p>

              <p className="display mt-5 max-w-md text-balance text-[19px] leading-snug text-ink sm:text-[21px]">
                “{persona.greeting}”
              </p>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-ink-soft">{persona.blurb}</p>
              <VineRule className="mt-7 h-5 w-56 text-[var(--accent)] opacity-45" />
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                persona={personaFor(message.personaId)}
                streaming={streamingId === message.id}
                onRetry={
                  message.id === lastId && message.role === "assistant" && !streamingId
                    ? onRetry
                    : undefined
                }
              />
            ))
          )}

          {waiting && <TypingRow persona={persona} />}
          <div className="h-2" />
        </div>

        {!pinned && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const el = scroller.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }}
            className="sticky bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border px-4 py-2 text-[12px] shadow-[var(--shadow-petal)] backdrop-blur"
            style={{
              background: "var(--paper-card)",
              borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
              color: "var(--accent-deep)",
            }}
          >
            ↓ latest
          </button>
        )}
      </div>
    </section>
  );
}
