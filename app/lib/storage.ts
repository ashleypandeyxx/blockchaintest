"use client";

import type { Conversation, Personality } from "./types";

const CONVERSATIONS_KEY = "glimmer.conversations.v1";
const CUSTOM_PERSONAS_KEY = "glimmer.personas.v1";
const ACTIVE_KEY = "glimmer.active.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or blocked storage shouldn't take the app down.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — the session just won't persist */
  }
}

export const loadConversations = (): Conversation[] =>
  read<Conversation[]>(CONVERSATIONS_KEY, []);
export const saveConversations = (value: Conversation[]): void =>
  write(CONVERSATIONS_KEY, value);

export const loadCustomPersonas = (): Personality[] =>
  read<Personality[]>(CUSTOM_PERSONAS_KEY, []);
export const saveCustomPersonas = (value: Personality[]): void =>
  write(CUSTOM_PERSONAS_KEY, value);

export const loadActiveConversationId = (): string | null =>
  read<string | null>(ACTIVE_KEY, null);
export const saveActiveConversationId = (value: string | null): void =>
  write(ACTIVE_KEY, value);
