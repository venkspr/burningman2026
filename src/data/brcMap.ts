import type { Camp } from "../data/types";
import { artPoint, BRC_ART, polar } from "./brcArt";

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
  /** Place on Center Camp ring instead of city street grid */
  centerCamp?: boolean;
};

function normalizeHour(hour: number): number {
  let h = hour;
  if (h === 0) h = 12;
  if (h > 12) h = h % 12 || 12;
  return h;
}

/** "6 & C" / "6:00 & C" / bare hour before & */
function parseLooseClock(text: string): { hour: number; minute: number } | null {
  const strict = [...text.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => ({
    hour: normalizeHour(Number(m[1])),
    minute: Number(m[2]),
  }));
  if (strict.length) return strict[0];

  const bare = text.match(/\b(\d{1,2})\s*&/);
  if (bare) return { hour: normalizeHour(Number(bare[1])), minute: 0 };
  return null;
}

function parseStreetKey(text: string): string {
  const named = text.match(
    /\b(esplanade|ararat|bodhi|chomolungma|delphi|eternal|fulcrum|great oak|heiau|iroko|jiba|kundalini)\b/i,
  );
  if (named) return named[1].toLowerCase();

  // Prefer letter before "Plaza" ("B Plaza") or classic " & G"
  const beforePlaza = text.match(/\b([A-Ka-k])\s*plaza\b/i);
  if (beforePlaza) return beforePlaza[1].toLowerCase();

  const letter = text.match(
    /(?:^|[\s,&@]|at\s+)([A-Ka-k])(?:\s|$|&|,|plaza)/i,
  );
  if (letter) return letter[1].toLowerCase();

  const lone = text.match(/\b([A-Ka-k])\b/);
  return lone ? lone[1].toLowerCase() : "";
}

/**
 * Parse strings like "7:30 & B", "A & 2:15", "4:30 B Plaza @ 2:15".
 *
 * Important: for "X:XX B Plaza @ Y:YY", X:XX is the plaza's city clock.
 * The @ time is a micro-position around that plaza — never the Man radial.
 */
export function parsePlacement(raw: string): ParsedPlacement | null {
  const text = raw.trim();
  if (!text) return null;
  if (/airport|none listed/i.test(text)) return null;

  // Center Camp — always near 6:00 / CC; @ time is around the plaza, not city clock
  if (/center\s*camp/i.test(text)) {
    const around = text.match(/@\s*(\d{1,2}):(\d{2})/);
    return {
      hour: around ? normalizeHour(Number(around[1])) : 6,
      minute: around ? Number(around[2]) : 0,
      street: 0,
      label: text,
      approximate: true,
      centerCamp: true,
    };
  }

  // Portals sit on Esplanade at that clock
  const portal = text.match(
    /(\d{1,2}):(\d{2})\s*portal|(\d{1,2})\s*portal/i,
  );
  if (portal) {
    const hour = normalizeHour(Number(portal[1] ?? portal[3]));
    const minute = portal[2] != null ? Number(portal[2]) : 0;
    return {
      hour,
      minute,
      street: 0,
      label: text,
      approximate: true,
    };
  }

  const streetKey = parseStreetKey(text);
  const isPlaza = /\bplaza\b/i.test(text);

  // Plaza city address is the clock *before* "Plaza", not the @ micro-time
  let clock: { hour: number; minute: number } | null = null;
  if (isPlaza) {
    const beforePlaza = text.match(
      /(\d{1,2}):(\d{2})(?=[^@]*\bplaza\b)/i,
    );
    if (beforePlaza) {
      clock = {
        hour: normalizeHour(Number(beforePlaza[1])),
        minute: Number(beforePlaza[2]),
      };
    }
  }

  if (!clock) clock = parseLooseClock(text);

  if (!clock && streetKey === "esplanade") {
    return {
      hour: 6,
      minute: 0,
      street: 0,
      label: text,
      approximate: true,
    };
  }

  if (!clock || !(streetKey in STREET_INDEX)) return null;

  return {
    hour: clock.hour,
    minute: clock.minute,
    street: STREET_INDEX[streetKey],
    label: text,
    approximate: isPlaza || undefined,
  };
}

export function placementToPoint(p: ParsedPlacement): { x: number; y: number } {
  if (p.centerCamp) {
    const { cx, cy, rEsp } = BRC_ART;
    // Same CC anchor as BrcArtMap; fan slightly by @ time around the plaza
    const base = polar(cx, cy, rEsp + 3.8, 180);
    const aroundDeg = ((p.hour % 12) + p.minute / 60) * 30;
    const ring = 2.2;
    const rad = (aroundDeg * Math.PI) / 180;
    return {
      x: base.x + ring * Math.sin(rad),
      y: base.y - ring * Math.cos(rad),
    };
  }
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
