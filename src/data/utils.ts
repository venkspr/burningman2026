import type { AmenityValue, Camp, CampAmenities } from "./types";

export const AMENITY_KEYS: (keyof CampAmenities)[] = [
  "shade",
  "power",
  "water",
  "shower",
  "kitchen",
  "food",
  "greyWater",
  "waste",
  "housing",
  "transport",
];

export const AMENITY_LABELS: Record<keyof CampAmenities, string> = {
  transport: "Transport / carpool",
  housing: "Housing",
  shade: "Shade",
  power: "Power",
  water: "Water",
  shower: "Shower",
  kitchen: "Kitchen",
  food: "Food",
  greyWater: "Grey water",
  waste: "Waste / recycling",
};

export const TAG_OPTIONS = [
  "queer",
  "music",
  "art",
  "bar",
  "food",
  "healing",
  "recovery",
  "circus",
  "family",
  "first-timers",
  "party",
  "wellness",
  "metal",
  "theater",
  "workshop",
] as const;

export function formatAmenity(v: AmenityValue): string {
  switch (v) {
    case "communal":
      return "Camp supplies";
    case "individual":
      return "Bring your own";
    case "both":
      return "Shared + DIY";
    case "na":
      return "N/A";
  }
}

export function formatDues(camp: Camp): string {
  if (camp.duesMin === 0) return "Free / donations";
  if (camp.duesMin == null) return "Ask camp";
  if (camp.dues.includes("-") || /sliding/i.test(camp.dues)) {
    return `From $${camp.duesMin.toLocaleString()}`;
  }
  return `$${camp.duesMin.toLocaleString()}`;
}

export function formatSize(camp: Camp): string {
  if (!camp.size || camp.size.trim() === "") return "Size TBD";
  if (camp.sizeMin === camp.sizeMax && camp.sizeMin > 0) {
    return `~${camp.sizeMin} people`;
  }
  if (camp.sizeMin > 0 && camp.sizeMax > 0) {
    return `${camp.sizeMin}–${camp.sizeMax} people`;
  }
  return camp.size;
}

export function hasCommunal(
  camp: Camp,
  key: keyof CampAmenities,
): boolean {
  const v = camp.amenities[key];
  return v === "communal" || v === "both";
}

export function ensureUrl(website: string): string {
  const w = website.trim();
  if (!w || /^n\/?a$/i.test(w) || w.toLowerCase() === "none" || w.toLowerCase() === "no") {
    return "";
  }
  if (/^https?:\/\//i.test(w)) return w;
  if (w.startsWith("www.")) return `https://${w}`;
  if (w.includes(".") && !w.includes(" ")) return `https://${w}`;
  return "";
}

export function truncate(text: string, n: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trim()}…`;
}
