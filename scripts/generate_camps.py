#!/usr/bin/env python3
"""Generate camps.json from the BRC 2026 camp placement sheet."""

from __future__ import annotations

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_SHEET = SCRIPT_DIR / "camps_sheet_raw.txt"
OUTPUT = SCRIPT_DIR.parent / "src" / "data" / "camps.json"

AMENITY_KEYS = [
    "transport",
    "housing",
    "shade",
    "power",
    "water",
    "shower",
    "kitchen",
    "food",
    "greyWater",
    "waste",
]

KNOWN_BROKEN_EMAILS = {"Art"}

# Manual fixes for misaligned or incomplete sheet rows.
OVERRIDES: dict[str, dict] = {
    "AAA Astro accessible arcade": {
        "website": "https://www.dawncollective.org/",
        "description": (
            "AAA Astro is an accessible arcade camp from the Dawn Collective in San Jose. "
            "The camp communalizes all major infrastructure and asks campers to assist with arcade games."
        ),
        "size": "60",
    },
    "Anonymous Village": {
        "description": (
            "Anonymous Village provides a supportive community and safe camping experience for people "
            "in recovery from drugs, alcohol, or other addiction. The camp hosts 12-step meetings and "
            "other clean and sober events, funded by voluntary contributions with no required dues."
        ),
        "size": "",
        "dues": "We are funded by voluntary contributions, no dues.",
        "duesMin": 0,
    },
    "Diptown": {
        "dues": "",
        "duesMin": None,
    },
    "Glowskull Asylum Int'l": {
        "dues": "",
        "duesMin": None,
    },
    "Mostly in Tune": {
        "dues": "",
        "duesMin": None,
    },
    "People's Art Congress": {
        "description": (
            "People's Art Congress is a participatory art camp seeking members who can contribute "
            "without drama and with strong leave-no-trace habits."
        ),
        "size": "",
        "sizeMin": 0,
        "sizeMax": 0,
    },
    "The makers space": {
        "email": "Art",
        "website": "",
        "description": (
            "The makers space is an art support camp offering classes for members and artists while "
            "helping install art across Black Rock City. Camp dues cover water, waste, and nightly dinner."
        ),
    },
    "The Sultry Lodge": {
        "size": "",
        "sizeMin": 0,
        "sizeMax": 0,
    },
    "The cage": {
        "dues": "Helping...",
        "duesMin": None,
    },
    "House of Skin": {
        "dues": "Nobe/none",
        "duesMin": 0,
        "scholarship": "no",
    },
    "Mona Camp": {
        "dues": "depends",
        "duesMin": None,
    },
    "BRC Snow Club": {
        "dues": "See Camp Info Deck: https://docs.google.com/presentation/d/1lvppQ-cTRvGAM88l1nlQN5XAT6w76GBTYVT4xdmKAxc",
        "duesMin": None,
    },
    "Rooftop Frose": {
        "website": "",
        "dues": "NA",
        "duesMin": 0,
    },
    "Stag Camp": {
        "dues": "Storage fees and keeping the Stag alive!",
        "duesMin": 0,
    },
    "Indigo's Speakeasy": {
        "scholarship": "no",
    },
    "Souilshakers": {
        "description": (
            "Souilshakers is a camp built around a photo bus art car and lively camp day parties. "
            "Members help with setup, build, strike, and party hosting while dues support the art car and events."
        ),
    },
    "Team Human Base Camp": {
        "cities": "",
    },
}

PLACEMENT_OVERRIDES: dict[str, str] = {
    "BLACK ROCK ADVENTURES BUS STOP!": "C at 3:45",
    "BUBBLE LOUNGE": "7:30 & B",
    "CAMP JUICY": "A at 4:45",
    "Casa de la Rumba": "7:30 & E",
    "Kentucky Fried Camp": "6 & C",
    "I love elephants": "Esplanade",
    "MindShark": "Esplanade & 3:00",
    "Short Bus Coffee Camp": "8:00 & A",
    "Snack Shack": "2:45 & B",
    "Wild Child": "6:00 & A",
    "The Sound Garden": "2:00 & Eternal",
}

# Camps not on the seeking-campers sheet but with known 2026 placements.
MANUAL_CAMPS: list[dict] = [
    {
        "name": "The Sound Garden",
        "email": "",
        "website": "https://directory.burningman.org/camps/586/",
        "description": (
            "High-vibe sound camp with a 360° system—DJs and performers by night; "
            "sound healings, deep house yoga, listening parties, bodywork, and healing "
            "workshops by day in the Garden Lounges."
        ),
        "size": "",
        "amenities": {k: "na" for k in AMENITY_KEYS},
        "duties": "",
        "dues": "",
        "duesMin": None,
        "scholarship": "no",
        "cities": "",
        "placement": "2:00 & Eternal",
    },
]


def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def parse_amenity(value: str) -> str:
    value = (value or "").strip()
    if not value or value.upper() == "N/A":
        return "na"
    has_communal = "Communalized by camp" in value
    has_individual = "Individuals supply themselves" in value
    if has_communal and has_individual:
        return "both"
    if has_communal:
        return "communal"
    if has_individual:
        return "individual"
    return "na"


def parse_scholarship(value: str) -> str:
    value = (value or "").strip().lower()
    if value == "yes":
        return "yes"
    if value == "maybe":
        return "maybe"
    return "no"


def parse_size(size_text: str) -> tuple[int, int]:
    text = (size_text or "").strip().lower()
    if not text:
        return 0, 0

    nums = [int(float(x)) for x in re.findall(r"\d+(?:\.\d+)?", text.replace(",", ""))]
    if not nums:
        if "under" in text:
            return 1, 19
        return 0, 0

    if any(marker in text for marker in ("up to", "no more than")) or "≤" in text:
        return 1, max(nums)
    if "under" in text:
        return 1, max(nums) - 1 if max(nums) > 1 else max(nums)
    if "ish" in text:
        center = nums[0]
        return int(center * 0.9), int(center * 1.1)
    if len(nums) >= 2:
        return min(nums), max(nums)

    n = nums[0]
    if "approx" in text or "~" in (size_text or ""):
        return int(n * 0.9), int(n * 1.1)
    return n, n


def parse_dues(dues_text: str) -> tuple[int | None, str]:
    text = (dues_text or "").strip()
    if not text:
        return None, text

    lower = text.lower()
    if lower in {"na", "n/a"}:
        return 0, text

    if any(
        phrase in lower
        for phrase in (
            "no dues",
            "none",
            "free",
            "donations are welcome",
            "donations welcome",
            "voluntary contributions",
            "nobe",
            "see camp info deck",
            "depends",
            "helping",
        )
    ):
        if not re.search(r"\d", text):
            return 0 if any(
                phrase in lower
                for phrase in ("no dues", "none", "free", "donations", "voluntary", "nobe", "0")
            ) else None, text

    euro = re.search(
        r"(?:€|eur)\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?",
        lower,
    ) or re.search(
        r"(\d+(?:\.\d+)?)\s*[-–]?\s*(\d+(?:\.\d+)?)?\s*(?:eur|€)",
        lower,
    )
    if euro:
        low = float(euro.group(1))
        return int(low * 1.1), text

    amounts: list[float] = []
    for match in re.finditer(r"(?<!\w)\$?\s*(\d+(?:\.\d+)?)", text):
        amounts.append(float(match.group(1)))

    if not amounts:
        if text.strip() in {"0", "None"} or lower in {"none", "free", "0"}:
            return 0, text
        return None, text

    return int(min(amounts)), text


def normalize_website(website: str) -> str:
    website = (website or "").strip()
    if not website or website.upper() == "NA":
        return ""
    if website.startswith("http://") or website.startswith("https://"):
        return website
    if website.startswith("www.") or "." in website:
        return f"https://{website}" if not website.startswith("http") else website
    return website


def trim_description(description: str) -> str:
    description = re.sub(r"\s+", " ", (description or "").strip())
    description = description.strip('"')
    if not description:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", description)
    trimmed = " ".join(sentences[:4]).strip()
    return trimmed if trimmed else description[:500]


def extract_placement(*texts: str) -> str:
    combined = " ".join(texts)
    patterns = [
        r"(?:placed|placement|plaza|on)\s+(?:at|on)?\s*([0-9]:?\d{0,2}\s*(?:&|and|@)\s*[A-Z0-9]+)",
        r"([0-9]:?\d{0,2}\s*(?:&|and|@)\s*[A-Z])\b",
        r"\b([A-Z])\s+at\s+([0-9:.]+)",
        r"\b(?:Esplanade)\b[^.]{0,40}",
        r"\b([0-9]:?\d{0,2})\s*&\s*([A-Z])\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            if match.lastindex and match.lastindex >= 2:
                return f"{match.group(1)} & {match.group(2)}"
            return match.group(0).strip()
    return ""


def derive_tags(name: str, description: str, duties: str, cities: str, amenities: dict) -> list[str]:
    blob = " ".join([name, description, duties, cities]).lower()
    tags: list[str] = []

    keyword_map = {
        "queer": ("queer", "lgbtq", "lbgtq"),
        "art": ("art support", "art camp", "art piece", "art installation", "artwork", "makers"),
        "music": ("music", "dj", "live band", "karaoke", "choir", "metal bar", "edm"),
        "bar": ("bar", "cocktail", "wine", "drinks", "speakeasy", "dive bar"),
        "recovery": ("recovery", "12-step", "12 step", "sober", "anonymous village"),
        "healing": ("healing", "massage", "spa", "yoga", "bodywork", "meditation"),
        "first-timers": ("first-time", "first time", "new burners", "burgins", "newbie"),
        "family": ("kids welcome", "all ages", "family"),
        "food": ("kitchen", "meal", "dinner", "pho", "ramen", "waffles", "coffee"),
        "dance": ("dance", "ecstatic", "contact improv"),
        "interactive": ("interactive", "interactivity", "workshop", "classes"),
        "mutant-vehicle": ("mutant vehicle", "art car"),
        "alcohol-free": ("alcohol free", "sober", "clean and sober"),
        "circus": ("circus", "aerial"),
        "games": ("arcade", "casino", "game", "mafia", "speed dating"),
    }

    for tag, keywords in keyword_map.items():
        if any(keyword in blob for keyword in keywords):
            tags.append(tag)

    if "esplanade" in blob:
        tags.append("esplanade")

    if amenities.get("food") == "communal" and "food" not in tags:
        if any(word in blob for word in ("kitchen", "meal", "food", "bar")):
            tags.append("food")

    return sorted(set(tags))


def split_records(raw: str) -> list[str]:
    lines = raw.split("\n")
    records: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if "\t" not in line:
            i += 1
            continue

        parts = line.split("\t", 2)
        if len(parts) < 2:
            i += 1
            continue

        email = parts[1].strip()
        if "@" not in email and email not in KNOWN_BROKEN_EMAILS:
            i += 1
            continue

        record_lines = [line]
        i += 1
        while i < len(lines):
            next_line = lines[i]
            if "\t" in next_line:
                next_parts = next_line.split("\t", 2)
                if len(next_parts) >= 2:
                    next_email = next_parts[1].strip()
                    if "@" in next_email or next_email in KNOWN_BROKEN_EMAILS:
                        break
            record_lines.append(next_line)
            i += 1

        records.append("\n".join(record_lines))

    return records


def parse_record(block: str) -> dict | None:
    fields = block.split("\t")
    while fields and fields[-1].strip() == "":
        fields.pop()

    if len(fields) < 18:
        return None

    if len(fields) == 18:
        cities = ""
        scholarship = fields[-1].strip()
        dues = fields[-2].strip()
        duties = fields[-3].strip()
        amenity_values = fields[-13:-3]
        size = fields[-14].strip()
        head = fields[:-14]
    else:
        # Some rows include extra tab columns; keep the canonical 19-field tail.
        if len(fields) > 19:
            fields = fields[:19]
        cities = fields[-1].strip()
        scholarship = fields[-2].strip()
        dues = fields[-3].strip()
        duties = fields[-4].strip()
        amenity_values = fields[-14:-4]
        size = fields[-15].strip()
        head = fields[:-15]

    name = head[0].strip()
    email = head[1].strip() if len(head) > 1 else ""
    website = head[2].strip() if len(head) > 2 else ""
    description = "\n".join(head[3:]).strip() if len(head) > 3 else ""

    padded = (amenity_values + [""] * len(AMENITY_KEYS))[: len(AMENITY_KEYS)]
    amenities = {
        key: parse_amenity(value) for key, value in zip(AMENITY_KEYS, padded)
    }

    return {
        "name": name,
        "email": email,
        "website": normalize_website(website),
        "description": trim_description(description),
        "size": size,
        "sizeMin": parse_size(size)[0],
        "sizeMax": parse_size(size)[1],
        "amenities": amenities,
        "duties": duties.strip(),
        "dues": dues,
        "duesMin": parse_dues(dues)[0],
        "scholarship": parse_scholarship(scholarship),
        "cities": cities.strip(),
        "placement": extract_placement(description, duties, name),
        "tags": [],
    }


def apply_overrides(camp: dict) -> None:
    override = OVERRIDES.get(camp["name"], {})
    for key, value in override.items():
        camp[key] = value

    if camp["name"] in PLACEMENT_OVERRIDES:
        camp["placement"] = PLACEMENT_OVERRIDES[camp["name"]]

    if "size" in override and "sizeMin" not in override:
        camp["sizeMin"], camp["sizeMax"] = parse_size(camp["size"])
    if "dues" in override and "duesMin" not in override:
        camp["duesMin"] = parse_dues(camp["dues"])[0]
    if "scholarship" in override:
        camp["scholarship"] = parse_scholarship(override["scholarship"])


def build_camp(camp: dict) -> dict:
    apply_overrides(camp)

    camp["id"] = slugify(camp["name"])
    camp["website"] = normalize_website(camp.get("website", ""))
    camp["description"] = trim_description(camp.get("description", ""))
    camp["sizeMin"], camp["sizeMax"] = parse_size(camp.get("size", ""))
    if camp.get("duesMin") is None and camp.get("dues"):
        camp["duesMin"] = parse_dues(camp["dues"])[0]
    camp["scholarship"] = parse_scholarship(camp.get("scholarship", "no"))
    if not camp.get("placement"):
        camp["placement"] = extract_placement(
            camp.get("description", ""),
            camp.get("duties", ""),
            camp.get("name", ""),
            camp.get("cities", ""),
        )
    camp["tags"] = derive_tags(
        camp["name"],
        camp["description"],
        camp.get("duties", ""),
        camp.get("cities", ""),
        camp.get("amenities", {}),
    )
    return camp


def main() -> None:
    raw = RAW_SHEET.read_text(encoding="utf-8")
    records = split_records(raw)
    camps: list[dict] = []

    for block in records:
        parsed = parse_record(block)
        if parsed is None:
            continue
        camps.append(build_camp(parsed))

    existing = {c["name"].lower() for c in camps}
    for manual in MANUAL_CAMPS:
        if manual["name"].lower() not in existing:
            camps.append(build_camp(dict(manual)))

    camps.sort(key=lambda c: c["name"].lower())

    # Ensure unique IDs
    seen_ids: dict[str, int] = {}
    for camp in camps:
        base = camp["id"]
        if base in seen_ids:
            seen_ids[base] += 1
            camp["id"] = f"{base}-{seen_ids[base]}"
        else:
            seen_ids[base] = 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as fh:
        json.dump(camps, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(f"Wrote {len(camps)} camps to {OUTPUT}")


if __name__ == "__main__":
    main()
