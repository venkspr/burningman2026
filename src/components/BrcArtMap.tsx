import {
  BRC_ART,
  CLOCK_LABELS,
  polar,
  ringArc,
} from "../data/brcArt";

/** Decorative branded horseshoe map — no PDF. */
export function BrcArtMap() {
  const { cx, cy, rEsp, rOuter, ringCount, openStartDeg, openEndDeg } = BRC_ART;
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const t = (i + 0.5) / ringCount;
    return rEsp + t * (rOuter - rEsp);
  });

  const radials: number[] = [];
  for (let d = openStartDeg; d <= openEndDeg; d += 15) radials.push(d);

  const outerStart = polar(cx, cy, rOuter, openStartDeg);
  const outerEnd = polar(cx, cy, rOuter, openEndDeg);
  const innerStart = polar(cx, cy, rEsp, openStartDeg);
  const innerEnd = polar(cx, cy, rEsp, openEndDeg);

  // Horseshoe fill: outer clockwise, then inner counterclockwise
  const cityFill = [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 1 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rEsp} ${rEsp} 0 1 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");

  const centerCamp = polar(cx, cy, rEsp + 3.8, 180);

  return (
    <svg
      className="brc-art"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <radialGradient id="playa-glow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#f8f2e8" />
          <stop offset="40%" stopColor="#ebe0ce" />
          <stop offset="100%" stopColor="#d2c2a6" />
        </radialGradient>
        <radialGradient id="city-fill" cx="50%" cy="58%" r="62%">
          <stop offset="0%" stopColor="rgba(13,110,110,0.14)" />
          <stop offset="55%" stopColor="rgba(13,110,110,0.32)" />
          <stop offset="100%" stopColor="rgba(13,110,110,0.1)" />
        </radialGradient>
        <radialGradient id="man-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c45c26" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#c45c26" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#c45c26" stopOpacity="0" />
        </radialGradient>
        <filter id="soft-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r="47" fill="url(#playa-glow)" />
      <circle
        cx={cx}
        cy={cy}
        r="45.5"
        fill="none"
        stroke="rgba(26,23,20,0.07)"
        strokeWidth="0.2"
      />

      <path d={cityFill} fill="url(#city-fill)" />

      {rings.map((r, i) => (
        <path
          key={`ring-${i}`}
          d={ringArc(cx, cy, r, openStartDeg, openEndDeg)}
          fill="none"
          stroke={
            i === 0
              ? "rgba(196,92,38,0.6)"
              : i % 3 === 0
                ? "rgba(26,23,20,0.24)"
                : "rgba(26,23,20,0.11)"
          }
          strokeWidth={i === 0 ? 0.38 : 0.16}
          strokeLinecap="round"
        />
      ))}

      {radials.map((deg) => {
        const a = polar(cx, cy, rEsp, deg);
        const b = polar(cx, cy, rOuter, deg);
        const major = deg % 30 === 0;
        return (
          <line
            key={`rad-${deg}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={major ? "rgba(26,23,20,0.3)" : "rgba(26,23,20,0.1)"}
            strokeWidth={major ? 0.22 : 0.11}
            strokeLinecap="round"
          />
        );
      })}

      <circle
        cx={centerCamp.x}
        cy={centerCamp.y}
        r="3.4"
        fill="rgba(247,242,234,0.9)"
        stroke="rgba(26,23,20,0.22)"
        strokeWidth="0.2"
      />
      <text
        x={centerCamp.x}
        y={centerCamp.y + 0.55}
        textAnchor="middle"
        className="brc-art-tiny"
      >
        CC
      </text>

      <circle
        cx={cx}
        cy={cy}
        r="6"
        fill="url(#man-glow)"
        filter="url(#soft-blur)"
      />
      <circle cx={cx} cy={cy} r="1.15" fill="#1a1714" />
      <circle cx={cx} cy={cy} r="0.4" fill="#e07a3d" />

      {CLOCK_LABELS.map((label) => {
        const [h, m] = label.split(":").map(Number);
        const deg = ((h % 12) + m / 60) * 30;
        const p = polar(cx, cy, rOuter + 4.4, deg);
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="brc-art-clock"
          >
            {label}
          </text>
        );
      })}

      <text x="50" y="93.5" textAnchor="middle" className="brc-art-title">
        Black Rock City · 2026
      </text>
    </svg>
  );
}
