import type { Camp } from "../data/types";
import { artPoint } from "./brcArt";

const STREET_INDEX: Record<string, number> = {
  esplanade: 0,
  esp: 0,
  a: 1,
  ararat: 1,
  b: 2,
  bodhi: 2,
  c: 3,
  chomolungma: 3,
  d: 4,
  delphi: 4,
  e: 5,
  eternal: 5,
  f: 6,
  fulcrum: 6,
  g: 7,
  "great oak": 7,
  h: 8,
  heiau: 8,
  i: 9,
  iroko: 9,
  j: 10,
  jiba: 10,
  k: 11,
  kundalini: 11,
};

export type ParsedPlacement = {
  hour: number;
  minute: number;
  street: number;
  label: string;
  approximate?: boolean;
};

function parseClock(text: string): { hour: number; minute: number } | null {
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour === 0) hour = 12;
  if (hour > 12) hour = hour % 12 || 12;
  return { hour, minute };
}

function parseStreetKey(text: string): string {
  const named = text.match(
    /\b(esplanade|ararat|bodhi|chomolungma|delphi|eternal|fulcrum|great oak|heiau|iroko|jiba|kundalini)\b/i,
  );
  if (named) return named[1].toLowerCase();

  // "B Plaza", "A & 2:15", "2:00 & G", "C at 3:45"
  const letter = text.match(
    /(?:^|[\s,&@]|at\s+|plaza\s*)([A-Ka-k])(?:\s|$|&|,|plaza)/i,
  );
  if (letter) return letter[1].toLowerCase();

  const lone = text.match(/\b([A-Ka-k])\b/);
  return lone ? lone[1].toLowerCase() : "";
}

/** Parse strings like "7:30 & B", "A & 2:15", "C at 3:45", "4:30 B Plaza @ 2:15" */
export function parsePlacement(raw: string): ParsedPlacement | null {
  const text = raw.trim();
  if (!text) return null;
  if (/airport/i.test(text)) return null;

  // Center Camp
  if (/center\s*camp/i.test(text)) {
    const clock = parseClock(text) ?? { hour: 6, minute: 0 };
    return {
      hour: clock.hour,
      minute: clock.minute,
      street: 1,
      label: text,
      approximate: true,
    };
  }

  const streetKey = parseStreetKey(text);
  const clocks = [...text.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => ({
    hour: Number(m[1]),
    minute: Number(m[2]),
  }));

  let clock = clocks[0] ?? null;
  // Prefer @ time when present ("… Plaza @ 2:15")
  const atClock = text.match(/@\s*(\d{1,2}):(\d{2})/);
  if (atClock) {
    clock = { hour: Number(atClock[1]), minute: Number(atClock[2]) };
  }

  if (!clock && streetKey === "esplanade") {
    return {
      hour: 4,
      minute: 0,
      street: 0,
      label: text,
      approximate: true,
    };
  }

  if (!clock || !(streetKey in STREET_INDEX)) return null;

  let hour = clock.hour;
  if (hour === 0) hour = 12;
  if (hour > 12) hour = hour % 12 || 12;

  return {
    hour,
    minute: clock.minute,
    street: STREET_INDEX[streetKey],
    label: text,
    approximate: /plaza/i.test(text) || undefined,
  };
}

export function placementToPoint(p: ParsedPlacement): { x: number; y: number } {
  return artPoint(p.hour, p.minute, p.street);
}

export type MapMarker = {
  camp: Camp;
  placement: ParsedPlacement;
  x: number;
  y: number;
};

export function campsToMarkers(camps: Camp[]): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const camp of camps) {
    const placement = parsePlacement(camp.placement);
    if (!placement) continue;
    const { x, y } = placementToPoint(placement);
    markers.push({ camp, placement, x, y });
  }
  return markers;
}
