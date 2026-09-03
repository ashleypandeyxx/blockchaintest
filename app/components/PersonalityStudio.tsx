"use client";

import { useEffect, useMemo, useState } from "react";
import type { Personality, Vibe } from "../lib/types";
import {
  DEFAULT_VIBE,
  STUDIO_PALETTES,
  buildSystemPrompt,
  makeId,
} from "../lib/personalities";
import {
  MOTIF_NAMES,
  Motif,
  MotifBadge,
  PetalMark,
  VineRule,
  motifLabel,
  type MotifName,
} from "./Botanicals";

interface Props {
  open: boolean;
  editing: Personality | null;
  onClose: () => void;
  onSave: (persona: Personality) => void;
  onDelete: (id: string) => void;
}

const SLIDERS: { key: keyof Vibe; label: string; low: string; high: string }[] = [
  { key: "sweetness", label: "Warmth", low: "cool & composed", high: "openly adoring" },
  { key: "sass", label: "Humour", low: "sincere", high: "sharp-tongued" },
  { key: "chaos", label: "Structure", low: "orderly", high: "delightfully feral" },
  { key: "brevity", label: "Length", low: "generous", high: "clipped" },
];

export function PersonalityStudio({ open, editing, onClose, onSave, onDelete }: Props) {
  if (!open) return null;
  return (
    <StudioForm
      key={editing?.id ?? "new"}
      editing={editing}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

function StudioForm({ editing, onClose, onSave, onDelete }: Omit<Props, "open">) {
  // Remounted per target by the key above, so initial values are enough.
  const [name, setName] = useState(editing?.name ?? "");
  const [tagline, setTagline] = useState(editing?.tagline ?? "");
  const [motif, setMotif] = useState<MotifName>(editing?.motif ?? "rose");
  const [paletteIndex, setPaletteIndex] = useState(() => {
    const index = STUDIO_PALETTES.findIndex((p) => p.theme.primary === editing?.theme.primary);
    return index >= 0 ? index : 0;
  });
  const [vibe, setVibe] = useState<Vibe>(editing?.vibe ?? DEFAULT_VIBE);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [greeting, setGreeting] = useState(editing?.greeting ?? "");
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState("");

  // Escape closes.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const palette = STUDIO_PALETTES[paletteIndex];

  const systemPrompt = useMemo(
    () => buildSystemPrompt({ name: name.trim() || "Your persona", tagline: tagline.trim(), vibe, notes }),
    [name, tagline, vibe, notes],
  );

  const previewGreeting =
    greeting.trim() ||
    (vibe.brevity > 66
      ? `${name.trim() || "Hi"}. What do you need?`
      : vibe.chaos > 66
        ? `hiiii it's ${name.trim() || "me"} — what are we getting into`
        : `Hi, I'm ${name.trim() || "your persona"}. What's on your mind today?`);

  const save = () => {
    if (!name.trim()) {
      setError("Give her a name first.");
      return;
    }
    const persona: Personality = {
      id: editing?.id ?? makeId("persona"),
      name: name.trim(),
      handle: `@${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") || "persona"}`,
      motif,
      tagline: tagline.trim() || "made in the studio",
      blurb: notes.trim().slice(0, 130) || "A personality you built yourself.",
      theme: palette.theme,
      greeting: previewGreeting,
      suggestions: [
        "Introduce yourself properly",
        "What are you good at?",
        "Help me with something small",
      ],
      typingLabel: `${name.trim()} is thinking`,
      systemPrompt,
      custom: true,
      vibe,
      notes: notes.trim(),
    };
    onSave(persona);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-[rgba(58,32,41,0.42)] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Personality Studio"
        className="bloom-in relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border shadow-[var(--shadow-lift)] sm:rounded-[28px]"
        style={{ background: "var(--paper)", borderColor: palette.theme.primary }}
      >
        {/* Header */}
        <div
          className="relative flex items-center gap-3 border-b px-6 py-5"
          style={{ borderColor: "var(--line)", background: palette.theme.soft }}
        >
          <PetalMark className="h-8 w-8" strokeWidth={1} />
          <div className="flex-1">
            <h2 className="display text-[20px] font-semibold leading-tight">Personality Studio</h2>
            <p className="text-[12px] text-ink-soft">
              Four dials and a note. We&apos;ll write the system prompt for you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the studio"
            className="rounded-full border px-3 py-1.5 text-[12px] transition-colors hover:bg-white/60"
            style={{ borderColor: "var(--line-strong)" }}
          >
            Close
          </button>
        </div>

        <div className="pretty-scroll grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1.1fr_0.9fr]">
          {/* ── Form ─────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Name</span>
                <input
                  value={name}
                  maxLength={28}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Clementine"
                  className="rounded-xl border bg-[var(--paper-card)] px-3 py-2.5 text-[14px] outline-none"
                  style={{ borderColor: "var(--line-strong)" }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Tagline</span>
                <input
                  value={tagline}
                  maxLength={40}
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="the patient one"
                  className="rounded-xl border bg-[var(--paper-card)] px-3 py-2.5 text-[14px] outline-none"
                  style={{ borderColor: "var(--line-strong)" }}
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Her flower</span>
              <div className="flex flex-wrap gap-2">
                {MOTIF_NAMES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMotif(option)}
                    aria-label={`Choose ${motifLabel(option)}`}
                    aria-pressed={motif === option}
                    className="flex flex-col items-center gap-1 rounded-2xl border px-3 py-2 transition-transform hover:scale-105"
                    style={{
                      borderColor: motif === option ? palette.theme.primary : "var(--line)",
                      background: motif === option ? palette.theme.soft : "var(--paper-card)",
                      color: palette.theme.deep,
                    }}
                  >
                    <Motif name={option} className="h-7 w-7" strokeWidth={1.3} />
                    <span className="text-[10px] text-ink-faint">{motifLabel(option)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Colour</span>
              <div className="flex flex-wrap gap-2">
                {STUDIO_PALETTES.map((option, index) => (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setPaletteIndex(index)}
                    aria-pressed={paletteIndex === index}
                    className="flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[12px] transition-transform hover:scale-105"
                    style={{
                      borderColor: paletteIndex === index ? option.theme.primary : "var(--line)",
                      background: paletteIndex === index ? option.theme.soft : "var(--paper-card)",
                    }}
                  >
                    <span
                      className="h-5 w-5 rounded-full"
                      style={{ background: option.theme.primary }}
                    />
                    {option.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--line)" }}>
              {SLIDERS.map((slider) => (
                <label key={slider.key} className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between">
                    <span className="eyebrow">{slider.label}</span>
                    <span className="text-[11px] text-ink-faint">
                      {vibe[slider.key] <= 33 ? slider.low : vibe[slider.key] <= 66 ? "balanced" : slider.high}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={vibe[slider.key]}
                    onChange={(event) =>
                      setVibe({ ...vibe, [slider.key]: Number(event.target.value) })
                    }
                    className="range"
                    style={{
                      ["--fill" as string]: `${vibe[slider.key]}%`,
                      ["--accent" as string]: palette.theme.primary,
                    }}
                  />
                </label>
              ))}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Anything else about her</span>
              <textarea
                value={notes}
                maxLength={600}
                rows={4}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="She's a retired ballet dancer who now runs a flower shop. She always relates advice back to something growing."
                className="resize-none rounded-xl border bg-[var(--paper-card)] px-3 py-2.5 text-[14px] leading-relaxed outline-none"
                style={{ borderColor: "var(--line-strong)" }}
              />
              <span className="text-[11px] text-ink-faint">
                This outranks the dials — it&apos;s the part that makes her hers.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Opening line (optional)</span>
              <input
                value={greeting}
                maxLength={200}
                onChange={(event) => setGreeting(event.target.value)}
                placeholder={previewGreeting}
                className="rounded-xl border bg-[var(--paper-card)] px-3 py-2.5 text-[14px] outline-none"
                style={{ borderColor: "var(--line-strong)" }}
              />
            </label>
          </div>

          {/* ── Preview ──────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-[22px] border p-5"
              style={{ background: palette.theme.soft, borderColor: palette.theme.primary }}
            >
              <span className="eyebrow">Preview</span>
              <div className="mt-3 flex gap-3" style={{ color: palette.theme.deep }}>
                <MotifBadge
                  name={motif}
                  className="h-10 w-10"
                  fill={palette.theme.bubble}
                  ring={palette.theme.primary}
                />
                <div className="min-w-0 flex-1">
                  <p className="display text-[14px] font-semibold">{name.trim() || "Your persona"}</p>
                  <p className="text-[11px] italic text-ink-faint">
                    {tagline.trim() || "made in the studio"}
                  </p>
                  <div
                    className="mt-2 rounded-[18px] rounded-tl-[5px] border px-3.5 py-2.5 text-[13.5px] leading-relaxed"
                    style={{
                      background: "var(--paper-card)",
                      borderColor: `color-mix(in srgb, ${palette.theme.primary} 30%, transparent)`,
                    }}
                  >
                    {previewGreeting}
                  </div>
                </div>
              </div>
              <VineRule className="mt-4 h-4 w-full opacity-45" />
            </div>

            <div className="rounded-[22px] border" style={{ borderColor: "var(--line)" }}>
              <button
                type="button"
                onClick={() => setShowPrompt((value) => !value)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="eyebrow">The system prompt we&apos;ll send</span>
                <span className="text-[11px] text-ink-faint">{showPrompt ? "hide" : "show"}</span>
              </button>
              {showPrompt && (
                <pre className="pretty-scroll max-h-64 overflow-auto whitespace-pre-wrap px-4 pb-4 text-[11.5px] leading-relaxed text-ink-soft">
                  {systemPrompt}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 border-t px-6 py-4"
          style={{ borderColor: "var(--line)", background: "var(--paper-card)" }}
        >
          {error && <span className="text-[12px] text-[var(--accent-deep)]">{error}</span>}
          {editing && (
            <button
              type="button"
              onClick={() => onDelete(editing.id)}
              className="text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-[var(--accent-deep)]"
            >
              Delete this personality
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-5 py-2.5 text-[13px] transition-colors hover:bg-[var(--paper-deep)]"
              style={{ borderColor: "var(--line-strong)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-full px-6 py-2.5 text-[13px] font-medium text-white transition-transform hover:scale-105"
              style={{
                background: palette.theme.primary,
                boxShadow: `0 10px 26px -14px ${palette.theme.primary}`,
              }}
            >
              {editing ? "Save changes" : "Bring her to life"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
