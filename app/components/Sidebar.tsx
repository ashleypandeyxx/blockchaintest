"use client";

import { useState } from "react";
import type { Conversation, Personality } from "../lib/types";
import { GlimmerMark, MotifBadge, VineRule } from "./Botanicals";

interface Props {
  personas: Personality[];
  customPersonas: Personality[];
  activePersonaId: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  open: boolean;
  onClose: () => void;
  onSelectPersona: (id: string) => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onEditPersona: (persona: Personality) => void;
  onOpenStudio: () => void;
}

type Tab = "cast" | "chats";

function PersonaCard({
  persona,
  active,
  onSelect,
  onEdit,
}: {
  persona: Personality;
  active: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="w-full rounded-[18px] border p-3 text-left transition-all hover:-translate-y-px"
        style={{
          borderColor: active
            ? persona.theme.primary
            : "color-mix(in srgb, var(--line-strong) 70%, transparent)",
          background: active ? persona.theme.soft : "var(--paper-card)",
          boxShadow: active ? `0 10px 26px -18px ${persona.theme.primary}` : undefined,
        }}
      >
        <div className="flex items-start gap-2.5" style={{ color: persona.theme.deep }}>
          <MotifBadge
            name={persona.motif}
            className="h-9 w-9"
            fill={persona.theme.bubble}
            ring={persona.theme.primary}
            strokeWidth={1.4}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="display truncate text-[14px] font-semibold text-ink">{persona.name}</span>
              {persona.custom && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-px text-[9px] uppercase tracking-wider"
                  style={{ background: persona.theme.bubble, color: persona.theme.deep }}
                >
                  yours
                </span>
              )}
            </div>
            <p className="truncate text-[11.5px] italic text-ink-faint">{persona.tagline}</p>
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink-soft">{persona.blurb}</p>
          </div>
        </div>
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${persona.name}`}
          className="absolute right-2 top-2 rounded-full border bg-[var(--paper-card)] px-2 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          style={{ borderColor: "var(--line-strong)" }}
        >
          edit
        </button>
      )}
    </div>
  );
}

export function Sidebar({
  personas,
  customPersonas,
  activePersonaId,
  conversations,
  activeConversationId,
  open,
  onClose,
  onSelectPersona,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onEditPersona,
  onOpenStudio,
}: Props) {
  const [tab, setTab] = useState<Tab>("cast");

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(58,32,41,0.35)] backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[19rem] flex-col border-r transition-transform duration-300 lg:static lg:z-10 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          borderColor: "var(--line)",
          background: "color-mix(in srgb, var(--paper-card) 90%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Brand */}
        <div className="px-5 pb-3 pt-6">
          <div className="flex items-center gap-2.5">
            <GlimmerMark className="h-7 w-7 text-[var(--accent)]" />
            <div>
              <h1 className="display text-[21px] font-semibold leading-none tracking-tight">Glimmer</h1>
              <p className="eyebrow mt-1">a chatbot with a cast</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="ml-auto text-ink-faint hover:text-ink lg:hidden"
            >
              ✕
            </button>
          </div>
          <VineRule className="mt-4 h-4 w-full text-[var(--accent)] opacity-40" />
        </div>

        {/* New conversation */}
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={onNewConversation}
            className="w-full rounded-full py-2.5 text-[13.5px] font-medium text-white transition-transform hover:scale-[1.02]"
            style={{ background: "var(--accent)", boxShadow: "0 10px 26px -14px var(--accent)" }}
          >
            Start a new conversation
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-5 mb-3 flex rounded-full border p-0.5" style={{ borderColor: "var(--line-strong)" }}>
          {(["cast", "chats"] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className="flex-1 rounded-full py-1.5 text-[12px] capitalize transition-colors"
              style={
                tab === value
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--ink-soft)" }
              }
            >
              {value === "cast" ? "The cast" : `Chats${conversations.length ? ` (${conversations.length})` : ""}`}
            </button>
          ))}
        </div>

        <div className="pretty-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {tab === "cast" ? (
            <div className="flex flex-col gap-2.5">
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  active={persona.id === activePersonaId}
                  onSelect={() => onSelectPersona(persona.id)}
                />
              ))}

              <div className="mt-3 flex items-center gap-2">
                <span className="eyebrow whitespace-nowrap">Made by you</span>
                <span className="h-px flex-1" style={{ background: "var(--line)" }} />
              </div>

              {customPersonas.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-ink-faint">
                  Nobody yet. Build a personality with your own voice, colour and temperament.
                </p>
              ) : (
                customPersonas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    active={persona.id === activePersonaId}
                    onSelect={() => onSelectPersona(persona.id)}
                    onEdit={() => onEditPersona(persona)}
                  />
                ))
              )}

              <button
                type="button"
                onClick={onOpenStudio}
                className="mt-1 rounded-[18px] border border-dashed py-3 text-[13px] transition-colors hover:bg-[var(--accent-soft)]"
                style={{ borderColor: "var(--line-strong)", color: "var(--accent-deep)" }}
              >
                ✿ Open the Personality Studio
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {conversations.length === 0 && (
                <p className="text-[12px] leading-relaxed text-ink-faint">
                  Your conversations will collect here.
                </p>
              )}
              {conversations.map((conversation) => {
                const active = conversation.id === activeConversationId;
                return (
                  <div key={conversation.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      className="w-full rounded-[14px] border px-3 py-2.5 pr-9 text-left transition-colors"
                      style={{
                        borderColor: active ? "var(--accent)" : "transparent",
                        background: active ? "var(--accent-soft)" : "transparent",
                      }}
                    >
                      <p className="truncate text-[13px] text-ink">{conversation.title}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {conversation.messages.length} message
                        {conversation.messages.length === 1 ? "" : "s"} ·{" "}
                        {new Date(conversation.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConversation(conversation.id)}
                      aria-label={`Delete ${conversation.title}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] text-ink-faint opacity-0 transition-opacity hover:text-[var(--accent-deep)] group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
