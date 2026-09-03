import type { MotifName } from "../components/Botanicals";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Which personality produced/received this message. */
  personaId: string;
  createdAt: number;
  /** Set when the assistant turn failed so the UI can offer a retry. */
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

/** The four dials the Personality Studio exposes. 0-100 each. */
export interface Vibe {
  sweetness: number;
  sass: number;
  chaos: number;
  brevity: number;
}

export interface PersonaTheme {
  /** Main accent — buttons, active states, the user's own bubbles. */
  primary: string;
  /** Tinted page wash. */
  soft: string;
  /** Darker accent for text on light surfaces. */
  deep: string;
  /** Halo / glow color, usually the primary at low alpha. */
  glow: string;
  /** Assistant bubble fill. */
  bubble: string;
}

export interface Personality {
  id: string;
  name: string;
  handle: string;
  /** Her flower — drawn, not an emoji. */
  motif: MotifName;
  tagline: string;
  blurb: string;
  theme: PersonaTheme;
  greeting: string;
  suggestions: string[];
  /** Shown next to the bouncing dots while she's thinking. */
  typingLabel: string;
  systemPrompt: string;
  /** True for personas the user built in the Studio. */
  custom?: boolean;
  vibe?: Vibe;
  notes?: string;
}
