/**
 * Hand-authored botanical line art. Everything here is drawn from paths and
 * rotated petals — no icon font, no stock clipart, no emoji standing in for
 * illustration. Each piece inherits `currentColor` so it re-tints per persona.
 */

/** Archimedean spiral, used as the heart of the roses. */
function spiral(cx: number, cy: number, turns: number, radius: number): string {
  const steps = turns * 40;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2 - Math.PI / 2;
    const r = radius * Math.pow(t, 0.82);
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join(" L ")}`;
}

const ROSE_SPIRAL = spiral(0, 0, 2.6, 13);

interface ArtProps {
  className?: string;
  strokeWidth?: number;
}

/** Five-petal daisy. Used as a bullet, a divider centre and a loading mark. */
export function PetalMark({ className = "", strokeWidth = 1.1 }: ArtProps) {
  return (
    <svg viewBox="-14 -14 28 28" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="0"
            cy="-6.6"
            rx="3.3"
            ry="5.6"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle cx="0" cy="0" r="2.3" fill="currentColor" stroke="none" opacity="0.8" />
      </g>
    </svg>
  );
}

/** A single spiral rose head with a petal cup behind it. */
export function RoseHead({ className = "", strokeWidth = 1.15 }: ArtProps) {
  return (
    <svg viewBox="-22 -22 44 44" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {[18, 90, 162, 234, 306].map((deg) => (
          <path
            key={deg}
            d="M0 -13 C 7.4 -18.6, 15.4 -13.4, 13.2 -5.6 C 11.8 -0.6, 5.6 2, 0 -1"
            transform={`rotate(${deg})`}
            opacity="0.75"
          />
        ))}
        <path d={ROSE_SPIRAL} />
      </g>
    </svg>
  );
}

/** A leafed stem. Mirror it with `scale(-1,1)` for the opposite side. */
export function LeafStem({ className = "", strokeWidth = 1.1 }: ArtProps) {
  return (
    <svg viewBox="0 0 60 150" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 150 C 26 118, 34 96, 30 66 C 27 44, 32 22, 30 4" />
        <path d="M30 122 C 16 118, 8 106, 8 92 C 22 92, 30 104, 30 122 Z" />
        <path d="M30 100 C 44 96, 52 84, 52 70 C 38 70, 30 82, 30 100 Z" />
        <path d="M30 74 C 17 71, 10 60, 10 48 C 22 48, 30 58, 30 74 Z" />
        <path d="M30 50 C 42 47, 49 37, 49 26 C 38 26, 30 36, 30 50 Z" />
        <path d="M30 122 L 15 100 M30 100 L 45 78 M30 74 L 17 56 M30 50 L 42 33" opacity="0.55" />
      </g>
    </svg>
  );
}

/** A small bud on a curving stem — the punctuation of the layout. */
export function Bud({ className = "", strokeWidth = 1.1 }: ArtProps) {
  return (
    <svg viewBox="0 0 34 60" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 60 C 14 46, 19 36, 17 26" />
        <path d="M17 26 C 10 26, 6 20, 7 13 C 8 6, 13 3, 17 3 C 21 3, 26 6, 27 13 C 28 20, 24 26, 17 26 Z" />
        <path d="M11 20 C 14 15, 14 9, 17 4 M23 20 C 20 15, 20 9, 17 4" opacity="0.6" />
        <path d="M17 44 C 9 43, 5 37, 5 31 C 12 31, 17 37, 17 44 Z" />
      </g>
    </svg>
  );
}

/** Horizontal vine rule with a daisy at the centre. */
export function VineRule({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 24" fill="none" className={className} aria-hidden preserveAspectRatio="none">
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <path d="M0 12 C 40 12, 60 5, 96 5 C 124 5, 132 12, 146 12" />
        <path d="M320 12 C 280 12, 260 19, 224 19 C 196 19, 188 12, 174 12" />
        <path d="M64 6 C 60 1, 52 0, 47 3 C 52 8, 60 9, 64 6 Z" opacity="0.8" />
        <path d="M256 18 C 260 23, 268 24, 273 21 C 268 16, 260 15, 256 18 Z" opacity="0.8" />
        <circle cx="112" cy="5" r="2" fill="currentColor" stroke="none" opacity="0.7" />
        <circle cx="208" cy="19" r="2" fill="currentColor" stroke="none" opacity="0.7" />
        <g transform="translate(160 12) scale(0.42)">
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="0" cy="-6.6" rx="3.3" ry="5.6" transform={`rotate(${deg})`} strokeWidth="2.4" />
          ))}
          <circle r="2.2" fill="currentColor" stroke="none" />
        </g>
      </g>
    </svg>
  );
}

/** Circular botanical frame — the centrepiece of the empty state. */
export function Wreath({ className = "" }: { className?: string }) {
  const sprigs = [200, 230, 260, 290, 320, 350, 20, 50, 80, 110, 140, 170];
  return (
    <svg viewBox="-120 -120 240 240" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <circle r="92" opacity="0.35" strokeDasharray="2 7" />
        {sprigs.map((deg, i) => (
          <g key={deg} transform={`rotate(${deg}) translate(0 -92)`} opacity={0.72}>
            <path d="M0 0 C -3 -10, 3 -18, 0 -28" />
            <path d={i % 2 === 0 ? "M0 -10 C -9 -11, -13 -18, -12 -24 C -4 -23, 0 -16, 0 -10 Z" : "M0 -10 C 9 -11, 13 -18, 12 -24 C 4 -23, 0 -16, 0 -10 Z"} />
            <path d={i % 2 === 0 ? "M0 -20 C 8 -21, 12 -27, 11 -33 C 4 -32, 0 -26, 0 -20 Z" : "M0 -20 C -8 -21, -12 -27, -11 -33 C -4 -32, 0 -26, 0 -20 Z"} />
          </g>
        ))}
        {[0, 120, 240].map((deg) => (
          <g key={deg} transform={`rotate(${deg}) translate(0 -92) rotate(${-deg}) scale(0.62)`}>
            {[18, 90, 162, 234, 306].map((p) => (
              <path key={p} d="M0 -13 C 7.4 -18.6, 15.4 -13.4, 13.2 -5.6 C 11.8 -0.6, 5.6 2, 0 -1" transform={`rotate(${p})`} opacity="0.85" strokeWidth="1.5" />
            ))}
            <path d={ROSE_SPIRAL} strokeWidth="1.5" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Corner spray for the page frame. */
export function CornerSpray({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-6 6 C 40 14, 74 42, 96 84 C 112 116, 126 146, 156 168" />
        <path d="M-6 6 C 26 40, 40 78, 44 118 C 47 148, 54 172, 74 194" />
        <path d="M34 26 C 30 12, 36 0, 48 -4 C 52 10, 46 22, 34 26 Z" />
        <path d="M58 54 C 66 44, 80 44, 88 52 C 78 62, 64 62, 58 54 Z" />
        <path d="M22 62 C 10 58, 4 46, 8 34 C 20 40, 26 52, 22 62 Z" />
        <path d="M84 100 C 96 94, 110 100, 114 112 C 100 116, 88 110, 84 100 Z" />
        <path d="M40 130 C 28 128, 20 116, 22 104 C 34 108, 42 118, 40 130 Z" />
        <g transform="translate(120 140) scale(0.85)">
          {[18, 90, 162, 234, 306].map((p) => (
            <path key={p} d="M0 -13 C 7.4 -18.6, 15.4 -13.4, 13.2 -5.6 C 11.8 -0.6, 5.6 2, 0 -1" transform={`rotate(${p})`} opacity="0.8" />
          ))}
          <path d={ROSE_SPIRAL} />
        </g>
        <g transform="translate(52 176) scale(0.55)">
          {[18, 90, 162, 234, 306].map((p) => (
            <path key={p} d="M0 -13 C 7.4 -18.6, 15.4 -13.4, 13.2 -5.6 C 11.8 -0.6, 5.6 2, 0 -1" transform={`rotate(${p})`} opacity="0.8" strokeWidth="1.6" />
          ))}
          <path d={ROSE_SPIRAL} strokeWidth="1.6" />
        </g>
      </g>
    </svg>
  );
}

/** Six-petal outline used as the app's mark. */
export function GlimmerMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-24 -24 48 48" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path key={deg} d="M0 0 C -7 -6, -7 -15, 0 -21 C 7 -15, 7 -6, 0 0 Z" transform={`rotate(${deg})`} />
        ))}
        <circle r="3.4" fill="currentColor" stroke="none" opacity="0.85" />
      </g>
    </svg>
  );
}

/* ── Persona motifs ─────────────────────────────────────────
   Each persona gets her own flower instead of an emoji. All are
   drawn in the same -22..22 box so they swap cleanly anywhere.
   ──────────────────────────────────────────────────────────── */

export type MotifName = "rose" | "daisy" | "tulip" | "cherry" | "fern" | "camellia";

export const MOTIF_NAMES: MotifName[] = [
  "rose",
  "daisy",
  "tulip",
  "cherry",
  "fern",
  "camellia",
];

const MOTIF_LABEL: Record<MotifName, string> = {
  rose: "Rose",
  daisy: "Daisy",
  tulip: "Tulip",
  cherry: "Cherry",
  fern: "Fern",
  camellia: "Camellia",
};

export const motifLabel = (name: MotifName) => MOTIF_LABEL[name];

function MotifShape({ name }: { name: MotifName }) {
  switch (name) {
    case "rose":
      return (
        <>
          {[18, 90, 162, 234, 306].map((deg) => (
            <path
              key={deg}
              d="M0 -11 C 6.4 -16, 13.4 -11.4, 11.4 -4.6 C 10.2 -0.4, 4.8 1.8, 0 -0.9"
              transform={`rotate(${deg})`}
              opacity="0.75"
            />
          ))}
          <path d={spiral(0, 0, 2.4, 10)} />
        </>
      );
    case "daisy":
      return (
        <>
          {[0, 51, 102, 153, 204, 255, 306].map((deg) => (
            <ellipse key={deg} cx="0" cy="-11" rx="3.4" ry="7" transform={`rotate(${deg})`} />
          ))}
          <circle r="3.6" />
          <circle r="1.4" fill="currentColor" stroke="none" opacity="0.7" />
        </>
      );
    case "tulip":
      return (
        <>
          <path d="M0 3 C 1 9, 0 15, 0 20" />
          <path d="M0 13 C -8 12, -13 7, -13 1 C -6 2, 0 7, 0 13 Z" />
          <path d="M0 17 C 8 16, 12 11, 12 6 C 5 7, 0 11, 0 17 Z" />
          <path d="M-9 -5 C -9 -14, -5 -20, 0 -21 C 5 -20, 9 -14, 9 -5 C 9 0.5, 5 3.5, 0 3.5 C -5 3.5, -9 0.5, -9 -5 Z" />
          <path d="M-9 -5 C -6 -10, -4.2 -15, -3.6 -20.2" opacity="0.7" />
          <path d="M9 -5 C 6 -10, 4.2 -15, 3.6 -20.2" opacity="0.7" />
          <path d="M-3.6 -20.2 C -2.2 -22.6, 2.2 -22.6, 3.6 -20.2" opacity="0.7" />
        </>
      );
    case "cherry":
      return (
        <>
          <path d="M0 -17 C -4 -11, -9 -7, -9 -1" />
          <path d="M0 -17 C 5 -12, 9 -7, 8 2" />
          <path d="M0 -17 C 5 -21, 12 -21, 16 -17 C 11 -12, 4 -12, 0 -17 Z" />
          <circle cx="-9" cy="6" r="7" />
          <circle cx="8" cy="9" r="5.4" />
          <path d="M-12.6 1.2 C -14 3.4, -14 6, -12.8 8" opacity="0.55" />
          <path d="M5.2 5.6 C 4.2 7.2, 4.2 9.2, 5.2 10.6" opacity="0.55" />
        </>
      );
    case "fern":
      return (
        <>
          <path d="M0 20 C -1 6, 1 -6, 0 -20" />
          {[16, 11, 6, 1, -4, -9].map((y, i) => {
            const k = 1 - i * 0.14;
            return (
              <g key={y}>
                <path
                  d={`M0 ${y} C ${(-8 * k).toFixed(1)} ${y - 1}, ${(-13 * k).toFixed(1)} ${y - 5}, ${(-12 * k).toFixed(1)} ${y - 10} C ${(-5 * k).toFixed(1)} ${y - 9}, 0 ${y - 4}, 0 ${y} Z`}
                />
                <path
                  d={`M0 ${y} C ${(8 * k).toFixed(1)} ${y - 1}, ${(13 * k).toFixed(1)} ${y - 5}, ${(12 * k).toFixed(1)} ${y - 10} C ${(5 * k).toFixed(1)} ${y - 9}, 0 ${y - 4}, 0 ${y} Z`}
                />
              </g>
            );
          })}
        </>
      );
    case "camellia":
      return (
        <>
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={`o${deg}`}
              d="M0 -6 C -8 -8, -13 -14, -11 -19 C -5 -21, 1 -16, 0 -6 Z"
              transform={`rotate(${deg})`}
            />
          ))}
          {[36, 108, 180, 252, 324].map((deg) => (
            <path
              key={`i${deg}`}
              d="M0 -3 C -5 -5, -8 -9, -7 -13 C -3 -14, 1 -10, 0 -3 Z"
              transform={`rotate(${deg})`}
              opacity="0.8"
            />
          ))}
          <circle r="2.6" fill="currentColor" stroke="none" opacity="0.75" />
        </>
      );
  }
}

/** A persona's flower, drawn in currentColor. */
export function Motif({
  name,
  className = "",
  strokeWidth = 1.2,
}: {
  name: MotifName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg viewBox="-22 -22 44 44" fill="none" className={className} aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <MotifShape name={name} />
      </g>
    </svg>
  );
}

/** Avatar medallion: a tinted disc, a hairline ring and the persona's flower. */
export function MotifBadge({
  name,
  className = "",
  fill = "var(--bubble)",
  ring = "var(--accent)",
  strokeWidth = 1.3,
}: {
  name: MotifName;
  className?: string;
  fill?: string;
  ring?: string;
  strokeWidth?: number;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ background: fill, boxShadow: `inset 0 0 0 1px ${ring}` }}
    >
      <Motif name={name} className="h-[62%] w-[62%]" strokeWidth={strokeWidth} />
    </span>
  );
}
