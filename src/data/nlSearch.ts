import type { Camp, CampAmenities, ScholarshipValue } from "./types";
import { parsePlacement, placementToPoint } from "./brcMap";
import { TAG_OPTIONS } from "./utils";

export type NlFilters = {
  amenity: keyof CampAmenities | "";
  scholarship: ScholarshipValue | "";
  tag: string;
  maxDues: string;
  maxSize: string;
  placementOnly: boolean;
  acceptingOnly: boolean;
  /** e.g. "7:00" or "7:15" — match placement clock */
  clockHint: string;
  /** e.g. "g", "esp" — match street letter / Esp */
  streetHint: string;
  /** Anchor camp id for "adjacent to / near [camp]" */
  nearCampId: string;
  nearCampName: string;
  /** Max map distance (percent units) from anchor */
  nearMaxDist: number;
};

export type NlInterpretation = {
  residualQuery: string;
  filters: NlFilters;
  insights: string[];
};

const EMPTY: NlFilters = {
  amenity: "",
  scholarship: "",
  tag: "",
  maxDues: "",
  maxSize: "",
  placementOnly: false,
  acceptingOnly: false,
  clockHint: "",
  streetHint: "",
  nearCampId: "",
  nearCampName: "",
  nearMaxDist: 0,
};

const AMENITY_PHRASES: { key: keyof CampAmenities; patterns: RegExp[] }[] = [
  {
    key: "shower",
    patterns: [/\bshowers?\b/i, /\brinses?\b/i, /\bwashing\b/i],
  },
  {
    key: "kitchen",
    patterns: [/\bkitchen\b/i, /\bcook(?:ing)?\b/i, /\bmeals?\b/i],
  },
  {
    key: "food",
    patterns: [
      /\b(?:with|serves|provides)\s+food\b/i,
      /\bserves?\s+meals?\b/i,
      /\bprovides?\s+meals?\b/i,
    ],
  },
  {
    key: "power",
    patterns: [/\bpower\b/i, /\belectric(?:ity)?\b/i, /\bcharging\b/i],
  },
  {
    key: "shade",
    patterns: [/\bshade\b/i, /\bshaded\b/i, /\bcanopy\b/i],
  },
  {
    key: "water",
    patterns: [/\bwater\b/i, /\bpotable\b/i],
  },
  {
    key: "housing",
    patterns: [/\bhousing\b/i, /\bshelter\b/i, /\bstructure\b/i, /\btents?\b/i],
  },
  {
    key: "transport",
    patterns: [/\btransport\b/i, /\bcarpool\b/i, /\bride[-\s]?share\b/i],
  },
  {
    key: "greyWater",
    patterns: [/\bgrey\s*water\b/i, /\bgray\s*water\b/i],
  },
  {
    key: "waste",
    patterns: [/\bwaste\b/i, /\brecycl(?:e|ing)\b/i, /\bmoop\b/i],
  },
];

const TAG_ALIASES: Record<string, string[]> = {
  queer: ["queer", "lgbt", "lgbtq", "lgbtqia", "gay", "lesbian", "trans", "pride"],
  music: ["music", "dj", "dance", "bass", "techno", "house", "sound camp", "sound system"],
  art: ["art", "artist", "sculpture", "installation"],
  bar: ["bar", "cocktail", "drinks", "booze", "pub", "tavern"],
  food: ["food", "kitchen", "meals", "cuisine", "restaurant"],
  healing: ["healing", "heal", "massage", "bodywork", "reiki"],
  recovery: ["recovery", "sober", "sobriety", "12 step", "aa", "na"],
  circus: ["circus", "acrobatics", "aerial"],
  family: ["family", "kids", "children", "kid friendly"],
  "first-timers": ["first timer", "first-timers", "virgin", "newbie", "new burner"],
  party: ["party", "rave", "nightlife", "dance party"],
  wellness: ["wellness", "yoga", "meditation", "mindfulness"],
  metal: ["metal", "heavy metal"],
  theater: ["theater", "theatre", "performance", "drama"],
  workshop: ["workshop", "class", "classes", "teach"],
};

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "with",
  "without",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "near",
  "around",
  "by",
  "from",
  "camp",
  "camps",
  "theme",
  "looking",
  "find",
  "show",
  "me",
  "want",
  "need",
  "please",
  "that",
  "have",
  "has",
  "are",
  "is",
  "who",
  "which",
  "any",
  "some",
  "good",
  "great",
  "nice",
  "cool",
]);

/** Collapse spaces/punctuation so "soundgarden" / "sound-garden" match "Sound Garden". */
export function compactText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Treat hyphens/underscores/slashes like spaces for search. */
export function normalizeSearchInput(s: string): string {
  return s
    .trim()
    .replace(/[-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesNameQuery(camp: Camp, rawQuery: string): boolean {
  const q = normalizeSearchInput(rawQuery);
  if (!q) return false;
  const compactQ = compactText(q);
  if (compactQ.length < 3) return false;

  const compactName = compactText(camp.name);
  if (!compactName) return false;

  // "soundgarden" / "sound-garden" → inside "thesoundgarden"
  if (compactName.includes(compactQ)) return true;

  // Near-exact alternate spelling length
  if (
    compactName.length >= 6 &&
    compactQ.length >= 6 &&
    Math.abs(compactName.length - compactQ.length) <= 2
  ) {
    const a = compactName.slice(0, Math.min(compactName.length, compactQ.length));
    const b = compactQ.slice(0, a.length);
    if (a === b) return true;
  }

  // Multi-word queries: "sound garden" / "pink heart" / "sound-garden"
  const qTokens = q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  if (qTokens.length < 2) return false;

  const nameTokens = camp.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);

  return qTokens.every(
    (t) =>
      nameTokens.some((n) => n === t || n.startsWith(t) || t.startsWith(n)) ||
      compactName.includes(t),
  );
}

function pushInsight(insights: string[], label: string) {
  if (!insights.includes(label)) insights.push(label);
}

function stripMatch(text: string, re: RegExp | string): string {
  return text.replace(re, " ");
}

export function resolveCampByName(
  nameQuery: string,
  camps: Camp[],
): Camp | null {
  const q = normalizeSearchInput(nameQuery)
    .replace(/\b(the\s+)?camps?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q || compactText(q).length < 3) return null;

  const exact: Camp[] = [];
  const fuzzy: Camp[] = [];
  const compactQ = compactText(q);

  for (const camp of camps) {
    if (matchesNameQuery(camp, q)) {
      exact.push(camp);
      continue;
    }
    const cn = compactText(camp.name);
    if (cn.includes(compactQ) || compactQ.includes(cn)) {
      // only if the shorter side is reasonably long (avoid "g" in everything)
      const shorter = Math.min(cn.length, compactQ.length);
      if (shorter >= 5) fuzzy.push(camp);
    }
  }

  const pool = exact.length ? exact : fuzzy;
  if (!pool.length) return null;

  // Prefer the tightest name match
  pool.sort(
    (a, b) =>
      compactText(a.name).length - compactText(b.name).length ||
      a.name.localeCompare(b.name),
  );
  return pool[0] ?? null;
}

export function campMapPoint(
  camp: Camp,
): { x: number; y: number } | null {
  const p = parsePlacement(camp.placement);
  if (!p) return null;
  return placementToPoint(p);
}

export function campDistance(a: Camp, b: Camp): number | null {
  const A = campMapPoint(a);
  const B = campMapPoint(b);
  if (!A || !B) return null;
  return Math.hypot(A.x - B.x, A.y - B.y);
}

export function matchesNearCamp(
  camp: Camp,
  nl: NlFilters,
  camps: Camp[],
): boolean {
  if (!nl.nearCampId) return true;
  const anchor = camps.find((c) => c.id === nl.nearCampId);
  if (!anchor) return true;
  if (camp.id === anchor.id) return true; // keep the reference camp visible
  const dist = campDistance(camp, anchor);
  if (dist == null) return false;
  return dist <= (nl.nearMaxDist || 8);
}

/** Turn a free-text ask into structured filters + leftover keywords. */
export function interpretQuery(
  raw: string,
  camps: Camp[] = [],
): NlInterpretation {
  let text = normalizeSearchInput(raw);
  const filters: NlFilters = { ...EMPTY };
  const insights: string[] = [];

  if (!text) {
    return { residualQuery: "", filters, insights };
  }

  // Nearby / adjacent to a named camp — before clock "near 7:00"
  const adjacent =
    text.match(
      /\b(?:camps?\s+)?(?:adjacent|next|close)\s+to\s+(.+)$/i,
    ) ??
    text.match(
      /\b(?:camps?\s+)?(?:beside|neighboring|neighbouring)\s+(.+)$/i,
    ) ??
    text.match(
      /\b(?:camps?\s+)?(?:near|around)\s+(?!\d{1,2}(?::\d{2})?\b)(.+)$/i,
    );

  if (adjacent && camps.length) {
    const anchor = resolveCampByName(adjacent[1], camps);
    if (anchor) {
      const tight = /\badjacent|next\s+to|beside|neighbor/i.test(adjacent[0]);
      filters.nearCampId = anchor.id;
      filters.nearCampName = anchor.name;
      filters.nearMaxDist = tight ? 8 : 12;
      filters.placementOnly = true;
      pushInsight(
        insights,
        `${tight ? "Adjacent to" : "Near"} ${anchor.name}`,
      );
      text = stripMatch(text, adjacent[0]);
      // leftover "camp" alone is not useful
      text = stripMatch(text, /\bcamps?\b/gi);
    }
  }

  // Dues: under $400 / max 500 / cheap / free / affordable
  const duesUnder = text.match(
    /\b(?:under|below|less than|max(?:imum)?|up to|<=?)\s*\$?\s*(\d{2,5})\b/i,
  );
  const duesBare = text.match(/\b\$\s*(\d{2,5})\b/);
  if (duesUnder) {
    filters.maxDues = duesUnder[1];
    pushInsight(insights, `Max dues $${duesUnder[1]}`);
    text = stripMatch(text, duesUnder[0]);
  } else if (/\b(free|no dues|donation(?:s)? only)\b/i.test(text)) {
    filters.maxDues = "0";
    pushInsight(insights, "Free / donations");
    text = stripMatch(text, /\b(free|no dues|donation(?:s)? only)\b/gi);
  } else if (/\b(cheap|affordable|budget|inexpensive)\b/i.test(text)) {
    filters.maxDues = "300";
    pushInsight(insights, "Budget (≤ $300)");
    text = stripMatch(text, /\b(cheap|affordable|budget|inexpensive)\b/gi);
  } else if (duesBare && /\bdues\b/i.test(raw)) {
    filters.maxDues = duesBare[1];
    pushInsight(insights, `Max dues $${duesBare[1]}`);
    text = stripMatch(text, duesBare[0]);
  }

  // Size: small / under 40 people
  const sizeUnder = text.match(
    /\b(?:under|below|less than|max(?:imum)?|up to|<=?)\s*(\d{1,3})\s*(?:people|person|pax|campers?)?\b/i,
  );
  if (/\b(small|intimate|tiny)\b/i.test(text)) {
    filters.maxSize = "40";
    pushInsight(insights, "Small camp (≤ 40)");
    text = stripMatch(text, /\b(small|intimate|tiny)\b/gi);
  } else if (sizeUnder && Number(sizeUnder[1]) <= 500) {
    // avoid colliding with dues numbers already handled
    if (!filters.maxDues || sizeUnder[1] !== filters.maxDues) {
      filters.maxSize = sizeUnder[1];
      pushInsight(insights, `Max size ${sizeUnder[1]}`);
      text = stripMatch(text, sizeUnder[0]);
    }
  }

  // Welcoming / seeking campers
  if (
    /\b(welcoming|accepting|seeking)\s+campers?\b/i.test(text) ||
    /\b(open to|looking for)\s+(new\s+)?(members?|campers?|people)\b/i.test(
      text,
    ) ||
    /\bjoin(?:able)?\b/i.test(text)
  ) {
    filters.acceptingOnly = true;
    pushInsight(insights, "Welcoming campers");
    text = stripMatch(
      text,
      /\b(welcoming|accepting|seeking)\s+campers?\b/gi,
    );
    text = stripMatch(
      text,
      /\b(open to|looking for)\s+(new\s+)?(members?|campers?|people)\b/gi,
    );
    text = stripMatch(text, /\bjoin(?:able)?\b/gi);
  }

  // Has address / on the map / placed
  if (
    /\b(on the map|has (?:an )?address|placed|with placement|with (?:a )?pin)\b/i.test(
      text,
    )
  ) {
    filters.placementOnly = true;
    pushInsight(insights, "Has address");
    text = stripMatch(
      text,
      /\b(on the map|has (?:an )?address|placed|with placement|with (?:a )?pin)\b/gi,
    );
  }

  // Scholarship / financial aid
  if (
    /\b(scholarship|financial aid|aid available|sliding scale)\b/i.test(text)
  ) {
    filters.scholarship = "yes";
    pushInsight(insights, "Financial aid");
    text = stripMatch(
      text,
      /\b(scholarship|financial aid|aid available|sliding scale)\b/gi,
    );
  }

  // "food camps" / bare food → vibe tag (not amenity). Amenity needs "with food" / "serves meals".
  if (
    !filters.tag &&
    (/\bfood\s+camps?\b/i.test(text) ||
      (/\bfood\b/i.test(text) &&
        !/\b(?:with|serves|provides)\s+food\b/i.test(text)))
  ) {
    filters.tag = "food";
    pushInsight(insights, "Vibe: food");
    text = stripMatch(text, /\bfood\s+camps?\b/gi);
    text = stripMatch(text, /\bfood\b/gi);
  }

  // Amenities (first match wins for the amenity dropdown)
  for (const { key, patterns } of AMENITY_PHRASES) {
    if (filters.amenity) break;
    for (const re of patterns) {
      if (re.test(text)) {
        filters.amenity = key;
        pushInsight(insights, `Supplies: ${key}`);
        text = stripMatch(text, re);
        break;
      }
    }
  }

  // Tags / vibes
  for (const tag of TAG_OPTIONS) {
    if (filters.tag) break;
    const aliases = TAG_ALIASES[tag] ?? [tag];
    for (const alias of aliases) {
      const re = new RegExp(
        `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      );
      if (re.test(text)) {
        filters.tag = tag;
        pushInsight(insights, `Vibe: ${tag}`);
        text = stripMatch(text, re);
        break;
      }
    }
  }

  // Clock: near 7:00 / at 3:15 / around 9
  const clock =
    text.match(
      /\b(?:near|around|at|by|close to)?\s*(\d{1,2}):(\d{2})\b/i,
    ) ?? text.match(/\b(?:near|around|at|by)\s*(\d{1,2})\b/i);
  if (clock) {
    const hour = Number(clock[1]);
    const minute = clock[2] != null ? Number(clock[2]) : 0;
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
      filters.clockHint = `${hour}:${String(minute).padStart(2, "0")}`;
      filters.placementOnly = true;
      pushInsight(insights, `Near ${filters.clockHint}`);
      text = stripMatch(text, clock[0]);
    }
  }

  // Street: on Esplanade / & G / street G / on Eternal
  const esp = text.match(/\b(?:on\s+)?esp(?:lanade)?\b/i);
  if (esp) {
    filters.streetHint = "esp";
    filters.placementOnly = true;
    pushInsight(insights, "Street: Esp");
    text = stripMatch(text, esp[0]);
  } else {
    const streetNamed = text.match(
      /\b(?:on|at)\s+(ararat|bodhi|chomolungma|delphi|eternal|fulcrum|great oak|heiau|iroko|jiba|kundalini)\b|&\s*(ararat|bodhi|chomolungma|delphi|eternal|fulcrum|great oak|heiau|iroko|jiba|kundalini)\b/i,
    );
    const streetLetter = text.match(
      /(?:(?:\b(?:on|at)\s+)|(?:&\s*))([A-Ka-k])(?:\s|$|,|\.|street)?\b/,
    );
    if (streetNamed) {
      const name = streetNamed[1] || streetNamed[2];
      filters.streetHint = name.toLowerCase();
      filters.placementOnly = true;
      pushInsight(insights, `Street: ${name}`);
      text = stripMatch(text, streetNamed[0]);
    } else if (streetLetter) {
      filters.streetHint = streetLetter[1].toLowerCase();
      filters.placementOnly = true;
      pushInsight(insights, `Street: ${streetLetter[1].toUpperCase()}`);
      text = stripMatch(text, streetLetter[0]);
    }
  }

  // Cleanup residual keywords
  const residualQuery = text
    .toLowerCase()
    .replace(/[^a-z0-9:\s&-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1)
    .join(" ");

  return { residualQuery, filters, insights };
}

function placementClockMinutes(placement: string): number | null {
  const m = placement.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  if (h === 0) h = 12;
  if (h > 12) h = h % 12 || 12;
  return h * 60 + Number(m[2]);
}

function clockDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % (12 * 60);
  return Math.min(diff, 12 * 60 - diff);
}

export function matchesNlPlacement(
  camp: Camp,
  nl: NlFilters,
): boolean {
  if (!nl.clockHint && !nl.streetHint) return true;
  const p = camp.placement.toLowerCase();
  if (!p.trim()) return false;

  if (nl.streetHint) {
    const hint = nl.streetHint.toLowerCase();
    if (hint === "esp" || hint === "esplanade") {
      if (!/\besp(?:lanade)?\b/i.test(p)) return false;
    } else if (hint.length === 1) {
      // letter street: " & g" / "g@" / " g "
      const re = new RegExp(
        `(?:^|[\\s,&]|at\\s+)${hint}(?:\\s|$|&|,|@|plaza)`,
        "i",
      );
      if (!re.test(p) && !new RegExp(`\\b${hint}\\b`, "i").test(p)) {
        return false;
      }
    } else if (!p.includes(hint)) {
      return false;
    }
  }

  if (nl.clockHint) {
    const target = placementClockMinutes(nl.clockHint);
    const got = placementClockMinutes(camp.placement);
    if (target == null || got == null) return false;
    // within ~45 minutes on the clock face
    if (clockDistance(target, got) > 45) return false;
  }

  return true;
}

/** Relevance score for ranking when a query is present. */
export function scoreCamp(
  camp: Camp,
  residualQuery: string,
  nl: NlFilters,
  rawQuery = "",
  camps: Camp[] = [],
): number {
  let score = 0;
  if (rawQuery && matchesNameQuery(camp, rawQuery)) {
    score += 40;
    const compactQ = compactText(rawQuery);
    const compactName = compactText(camp.name);
    if (compactName === compactQ) score += 20;
    else if (compactName.startsWith(compactQ) || compactQ.startsWith(compactName)) {
      score += 10;
    }
  }

  if (nl.nearCampId && camps.length) {
    const anchor = camps.find((c) => c.id === nl.nearCampId);
    if (anchor) {
      if (camp.id === anchor.id) score += 50;
      else {
        const dist = campDistance(camp, anchor);
        if (dist != null && dist <= (nl.nearMaxDist || 8)) {
          score += Math.max(5, Math.round(30 - dist * 2));
        }
      }
    }
  }

  const q = residualQuery.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const name = camp.name.toLowerCase();
  const desc = camp.description.toLowerCase();
  const hay = [
    name,
    desc,
    camp.cities,
    camp.hometown ?? "",
    camp.placement,
    ...camp.tags,
  ]
    .join(" ")
    .toLowerCase();
  const compactHay = compactText(hay);

  for (const t of tokens) {
    if (name === t || name.includes(t)) score += 12;
    else if (compactHay.includes(compactText(t))) score += 10;
    else if (camp.tags.some((tag) => tag.toLowerCase().includes(t))) score += 8;
    else if (hay.includes(t)) score += 3;
  }

  if (nl.tag && camp.tags.map((t) => t.toLowerCase()).includes(nl.tag)) {
    score += 6;
  }
  if (nl.acceptingOnly && camp.acceptingCampers) score += 2;
  if (nl.clockHint && matchesNlPlacement(camp, { ...EMPTY, clockHint: nl.clockHint })) {
    score += 5;
  }
  if (nl.streetHint && matchesNlPlacement(camp, { ...EMPTY, streetHint: nl.streetHint })) {
    score += 4;
  }

  return score;
}

export const NL_EXAMPLES = [
  "food camps near soundgarden",
  "camp adjacent to soundgarden",
  "queer camp with showers under $400",
  "cheap music camp near 7:00",
  "welcoming campers on Esplanade",
] as const;
