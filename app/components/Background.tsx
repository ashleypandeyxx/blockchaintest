"use client";

import { CornerSpray } from "./Botanicals";

/** Fixed, not random — a stable list keeps server and client markup identical. */
const PETALS = [
  { left: "6%", delay: "0s", duration: "19s", size: 15, sway: "70px", tilt: -18 },
  { left: "18%", delay: "6s", duration: "24s", size: 10, sway: "-50px", tilt: 24 },
  { left: "31%", delay: "12s", duration: "21s", size: 13, sway: "90px", tilt: 8 },
  { left: "44%", delay: "3s", duration: "27s", size: 9, sway: "-70px", tilt: -32 },
  { left: "57%", delay: "15s", duration: "20s", size: 16, sway: "60px", tilt: 40 },
  { left: "69%", delay: "9s", duration: "25s", size: 11, sway: "-85px", tilt: -6 },
  { left: "81%", delay: "18s", duration: "22s", size: 14, sway: "45px", tilt: 16 },
  { left: "93%", delay: "1s", duration: "26s", size: 10, sway: "-60px", tilt: -24 },
];

export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Colour wash — two soft blooms that follow the active persona. */}
      <div
        className="drift-slow absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{ background: "var(--accent-glow)", opacity: 0.5 }}
      />
      <div
        className="drift-slow absolute -bottom-56 -right-32 h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{ background: "var(--accent-glow)", opacity: 0.35, animationDelay: "-9s" }}
      />

      {/* Engraved corner sprays. */}
      <CornerSpray className="absolute -left-6 -top-6 h-64 w-64 opacity-[0.16] text-[var(--accent-deep)]" />
      <CornerSpray className="absolute -bottom-6 -right-6 h-64 w-64 rotate-180 opacity-[0.16] text-[var(--accent-deep)]" />

      {/* Drifting petals. */}
      {PETALS.map((petal, i) => (
        <div
          key={i}
          className="absolute top-0"
          style={{
            left: petal.left,
            width: petal.size,
            height: petal.size * 1.35,
            borderRadius: "62% 38% 58% 42% / 70% 66% 34% 30%",
            background: "var(--accent)",
            opacity: 0,
            transform: `rotate(${petal.tilt}deg)`,
            animation: `petal-fall ${petal.duration} linear ${petal.delay} infinite`,
            ["--sway" as string]: petal.sway,
          }}
        />
      ))}
    </div>
  );
}
