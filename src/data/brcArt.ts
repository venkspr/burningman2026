/** Shared geometry for the branded SVG city map (percent of stage). */
export const BRC_ART = {
  cx: 50,
  /** Man sits slightly above center so the 2–10 horseshoe reads clearly */
  cy: 46,
  rEsp: 18,
  rOuter: 40,
  ringCount: 12,
  /** City spans ~2:00 (60°) through 10:00 (300°) clockwise from 12 */
  openStartDeg: 60,
  openEndDeg: 300,
} as const;

export const STREET_NAMES = [
  "Esplanade",
  "Ararat",
  "Bodhi",
  "Chomolungma",
  "Delphi",
  "Eternal",
  "Fulcrum",
  "Great Oak",
  "Heiau",
  "Iroko",
  "Jiba",
  "Kundalini",
] as const;

export const CLOCK_LABELS = [
  "2:00",
  "3:00",
  "4:00",
  "5:00",
  "6:00",
  "7:00",
  "8:00",
  "9:00",
  "10:00",
] as const;

export function clockToRad(hour: number, minute = 0): number {
  const clockHours = (hour % 12) + minute / 60;
  const deg = clockHours * 30; // from 12, clockwise
  return (deg * Math.PI) / 180;
}

/** Point in % of the art map stage */
export function artPoint(
  hour: number,
  minute: number,
  streetIndex: number,
): { x: number; y: number } {
  const { cx, cy, rEsp, rOuter, ringCount } = BRC_ART;
  const rad = clockToRad(hour, minute);
  const t = (streetIndex + 0.5) / ringCount;
  const r = rEsp + t * (rOuter - rEsp);
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

export function polar(
  cx: number,
  cy: number,
  r: number,
  degFrom12: number,
): { x: number; y: number } {
  const rad = (degFrom12 * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

/** Arc path for a ring between startDeg and endDeg (from 12, clockwise). */
export function ringArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}
