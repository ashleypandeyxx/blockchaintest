"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Message, Personality } from "../lib/types";
import {
  DEFAULT_PERSONA_ID,
  PERSONALITIES,
  findPersona,
  makeId,
} from "../lib/personalities";
import {
  loadActiveConversationId,
  loadConversations,
  loadCustomPersonas,
  saveActiveConversationId,
  saveConversations,
  saveCustomPersonas,
} from "../lib/storage";
import { useMounted } from "../lib/useMounted";
import { streamReply } from "../lib/stream";
import { Background } from "./Background";
import { ChatWindow } from "./ChatWindow";
import { Composer } from "./Composer";
import { PersonalityStudio } from "./PersonalityStudio";
import { Sidebar } from "./Sidebar";
import { Motif, Wreath } from "./Botanicals";

function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}…` : clean || "New conversation";
}

/** First paint, before localStorage is readable. Keeps the entry graceful. */
function Opening() {
  return (
    <div className="relative flex h-dvh w-full items-center justify-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <Wreath className="stem-draw absolute inset-0 h-56 w-56 text-[var(--accent)] opacity-55" />
        <div className="flex flex-col items-center gap-2">
          <Motif name="camellia" className="h-10 w-10 text-[var(--accent-deep)]" />
          <span className="display text-[20px] font-semibold">Glimmer</span>
          <span className="eyebrow">a chatbot with a cast</span>
        </div>
      </div>
    </div>
  );
}

export function ChatApp() {
  const mounted = useMounted();
  return mounted ? <ChatAppInner /> : <Opening />;
}

function ChatAppInner() {
  // Read once, synchronously — this subtree only mounts on the client.
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [customPersonas, setCustomPersonas] = useState<Personality[]>(loadCustomPersonas);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    const stored = loadConversations();
    const wanted = loadActiveConversationId();
    return (stored.find((c) => c.id === wanted) ?? stored[0])?.id ?? null;
  });
  const [activePersonaId, setActivePersonaId] = useState(() => {
    const stored = loadConversations();
    const wanted = loadActiveConversationId();
    return (stored.find((c) => c.id === wanted) ?? stored[0])?.personaId ?? DEFAULT_PERSONA_ID;
  });

  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Personality | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  /* ── Persistence ──────────────────────────────────────── */

  useEffect(() => saveConversations(conversations), [conversations]);
  useEffect(() => saveCustomPersonas(customPersonas), [customPersonas]);
  useEffect(() => saveActiveConversationId(activeConversationId), [activeConversationId]);

  /* ── Derived ──────────────────────────────────────────── */

  const personaFor = useCallback(
    (id: string) => findPersona(id, customPersonas),
    [customPersonas],
  );

  const persona = personaFor(activePersonaId);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const busy = waiting || streamingId !== null;

  // Every accent token on the page flows from the active persona.
  const themeVars = useMemo(
    () =>
      ({
        "--accent": persona.theme.primary,
        "--accent-soft": persona.theme.soft,
        "--accent-deep": persona.theme.deep,
        "--accent-glow": persona.theme.glow,
        "--bubble": persona.theme.bubble,
      }) as React.CSSProperties,
    [persona],
  );

  const patch = useCallback((id: string, update: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? update(c) : c)));
  }, []);

  /* ── Sending ──────────────────────────────────────────── */

  const run = useCallback(
    async (conversationId: string, history: Message[], activePersona: Personality, switchedFrom?: string) => {
      const assistantId = makeId("msg");
      const controller = new AbortController();
      abortRef.current = controller;

      setWaiting(true);

      let started = false;
      const placeholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        personaId: activePersona.id,
        createdAt: Date.now(),
      };

      try {
        await streamReply({
          messages: history.map(({ role, content }) => ({ role, content })),
          systemPrompt: activePersona.systemPrompt,
          personaName: activePersona.name,
          switchedFrom,
          signal: controller.signal,
          onDelta: (text) => {
            if (!started) {
              started = true;
              setWaiting(false);
              setStreamingId(assistantId);
              patch(conversationId, (c) => ({
                ...c,
                messages: [...c.messages, placeholder],
                updatedAt: Date.now(),
              }));
            }
            patch(conversationId, (c) => ({
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + text } : m,
              ),
              updatedAt: Date.now(),
            }));
          },
        });

        // An empty but successful turn still needs somewhere to land.
        if (!started) {
          patch(conversationId, (c) => ({
            ...c,
            messages: [...c.messages, { ...placeholder, content: "…" }],
            updatedAt: Date.now(),
          }));
        }
      } catch (error) {
        if (controller.signal.aborted) {
          // Stopped on purpose — keep whatever streamed in.
          return;
        }
        const message =
          error instanceof Error ? error.message : "Something went wrong. Try again?";

        patch(conversationId, (c) => {
          const exists = c.messages.some((m) => m.id === assistantId);
          return {
            ...c,
            messages: exists
              ? c.messages.map((m) => (m.id === assistantId ? { ...m, error: message } : m))
              : [...c.messages, { ...placeholder, error: message }],
            updatedAt: Date.now(),
          };
        });
      } finally {
        setWaiting(false);
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [patch],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      const now = Date.now();
      const userMessage: Message = {
        id: makeId("msg"),
        role: "user",
        content: text,
        personaId: persona.id,
        createdAt: now,
      };

      let target = conversation;

      if (!target) {
        target = {
          id: makeId("conv"),
          title: titleFrom(text),
          personaId: persona.id,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        setConversations((prev) => [target as Conversation, ...prev]);
        setActiveConversationId(target.id);
      }

      // Did the user swap personas since the last reply?
      const previousAssistant = [...target.messages]
        .reverse()
        .find((m) => m.role === "assistant" && !m.error);
      const switchedFrom =
        previousAssistant && previousAssistant.personaId !== persona.id
          ? personaFor(previousAssistant.personaId).name
          : undefined;

      const history = [...target.messages.filter((m) => !m.error), userMessage];
      const conversationId = target.id;
      const firstMessage = target.messages.length === 0;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                title: firstMessage ? titleFrom(text) : c.title,
                personaId: persona.id,
                messages: [...c.messages, userMessage],
                updatedAt: now,
              }
            : c,
        ),
      );

      setInput("");
      void run(conversationId, history, persona, switchedFrom);
    },
    [busy, conversation, persona, personaFor, run],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setWaiting(false);
    setStreamingId(null);
  }, []);

  const retry = useCallback(() => {
    if (!conversation || busy) return;
    const messages = [...conversation.messages];
    while (messages.length && messages[messages.length - 1].role === "assistant") messages.pop();
    if (messages.length === 0) return;

    const conversationId = conversation.id;
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, messages } : c)),
    );
    void run(conversationId, messages, persona);
  }, [busy, conversation, persona, run]);

  /* ── Conversation & persona management ────────────────── */

  const newConversation = useCallback(() => {
    stop();
    setActiveConversationId(null);
    setInput("");
    setSidebarOpen(false);
  }, [stop]);

  const selectConversation = useCallback(
    (id: string) => {
      stop();
      setActiveConversationId(id);
      const found = conversations.find((c) => c.id === id);
      if (found) setActivePersonaId(found.personaId);
      setSidebarOpen(false);
    },
    [conversations, stop],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeConversationId) {
        stop();
        setActiveConversationId(null);
      }
    },
    [activeConversationId, stop],
  );

  const selectPersona = useCallback(
    (id: string) => {
      setActivePersonaId(id);
      setSidebarOpen(false);
      if (activeConversationId) {
        patch(activeConversationId, (c) => ({ ...c, personaId: id }));
      }
    },
    [activeConversationId, patch],
  );

  const savePersona = useCallback(
    (next: Personality) => {
      setCustomPersonas((prev) => {
        const exists = prev.some((p) => p.id === next.id);
        return exists ? prev.map((p) => (p.id === next.id ? next : p)) : [...prev, next];
      });
      setActivePersonaId(next.id);
      if (activeConversationId) {
        patch(activeConversationId, (c) => ({ ...c, personaId: next.id }));
      }
      setStudioOpen(false);
      setEditingPersona(null);
    },
    [activeConversationId, patch],
  );

  const deletePersona = useCallback(
    (id: string) => {
      setCustomPersonas((prev) => prev.filter((p) => p.id !== id));
      if (activePersonaId === id) setActivePersonaId(DEFAULT_PERSONA_ID);
      setStudioOpen(false);
      setEditingPersona(null);
    },
    [activePersonaId],
  );

  const rename = useCallback(
    (title: string) => {
      if (activeConversationId) patch(activeConversationId, (c) => ({ ...c, title }));
    },
    [activeConversationId, patch],
  );

  const suggestions = conversation && conversation.messages.length > 0 ? [] : persona.suggestions;

  return (
    <div style={themeVars} className="relative flex h-dvh w-full overflow-hidden">
      <Background />

      <Sidebar
        personas={PERSONALITIES}
        customPersonas={customPersonas}
        activePersonaId={activePersonaId}
        conversations={conversations}
        activeConversationId={activeConversationId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectPersona={selectPersona}
        onNewConversation={newConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onEditPersona={(p) => {
          setEditingPersona(p);
          setStudioOpen(true);
          setSidebarOpen(false);
        }}
        onOpenStudio={() => {
          setEditingPersona(null);
          setStudioOpen(true);
          setSidebarOpen(false);
        }}
      />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <ChatWindow
          conversation={conversation}
          persona={persona}
          personaFor={personaFor}
          streamingId={streamingId}
          waiting={waiting}
          onRetry={retry}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenStudio={() => {
            setEditingPersona(null);
            setStudioOpen(true);
          }}
          onRename={rename}
        />
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => send(input)}
          onStop={stop}
          busy={busy}
          persona={persona}
          suggestions={suggestions}
          onSuggestion={(text) => send(text)}
        />
      </main>

      <PersonalityStudio
        open={studioOpen}
        editing={editingPersona}
        onClose={() => {
          setStudioOpen(false);
          setEditingPersona(null);
        }}
        onSave={savePersona}
        onDelete={deletePersona}
      />
    </div>
  );
}
