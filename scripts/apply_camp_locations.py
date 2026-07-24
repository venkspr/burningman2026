#!/usr/bin/env python3
"""Merge official BRC 2026 camp locations into camps.json by name."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAMPS_PATH = ROOT / "src" / "data" / "camps.json"
LOCS_PATH = ROOT / "src" / "data" / "camp_locations_2026.json"


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("&", " and ").replace("+", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\b(camp|the|theme)\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def slugify(s: str) -> str:
    s = norm_name(s).replace(" ", "-")
    return s or "camp"


def empty_amenities():
    return {
        "transport": "na",
        "housing": "na",
        "shade": "na",
        "power": "na",
        "water": "na",
        "shower": "na",
        "kitchen": "na",
        "food": "na",
        "greyWater": "na",
        "waste": "na",
    }


def main() -> None:
    camps: list[dict] = json.loads(CAMPS_PATH.read_text())
    locs: list[dict] = json.loads(LOCS_PATH.read_text())

    by_norm: dict[str, list[dict]] = {}
    for c in camps:
        by_norm.setdefault(norm_name(c["name"]), []).append(c)

    matched = 0
    updated = 0
    created = 0
    skipped_man = 0
    unmatched_locs: list[str] = []

    used_ids = {c["id"] for c in camps}

    for loc in locs:
        name = (loc.get("n") or "").strip()
        addr = (loc.get("a") or "").strip()
        if not name:
            continue
        if re.search(r"^the\s+man$", name, re.I) or addr.lower() == "epicenter":
            skipped_man += 1
            continue

        key = norm_name(name)
        candidates = by_norm.get(key, [])

        # Soft fallback: unique prefix / containment
        if not candidates:
            soft = []
            for k, group in by_norm.items():
                if not k or not key:
                    continue
                if k == key or k.startswith(key) or key.startswith(k):
                    soft.extend(group)
                elif key in k or k in key:
                    soft.extend(group)
            # only accept soft if unique camp
            uniq = {c["id"]: c for c in soft}
            if len(uniq) == 1:
                candidates = list(uniq.values())

        if candidates:
            # Prefer officialListed / existing placementSource user when multiple
            camp = sorted(
                candidates,
                key=lambda c: (
                    0 if c.get("officialListed") else 1,
                    0 if c.get("placementSource") == "user" else 1,
                    c["name"],
                ),
            )[0]
            matched += 1
            if camp.get("placement") != addr or camp.get("placementSource") != "official":
                camp["placement"] = addr
                camp["placementSource"] = "official"
                updated += 1
        else:
            unmatched_locs.append(name)
            # Add as a map-only listing so pins still show
            base = slugify(name)
            cid = base
            n = 2
            while cid in used_ids:
                cid = f"{base}-{n}"
                n += 1
            used_ids.add(cid)
            new_camp = {
                "id": cid,
                "name": name,
                "email": "",
                "website": "",
                "description": "",
                "size": "",
                "sizeMin": 0,
                "sizeMax": 0,
                "amenities": empty_amenities(),
                "duties": "",
                "dues": "",
                "duesMin": None,
                "scholarship": "no",
                "cities": "",
                "hometown": "",
                "tags": [],
                "acceptingCampers": False,
                "officialListed": True,
                "placement": addr,
                "placementSource": "official",
            }
            camps.append(new_camp)
            by_norm.setdefault(key, []).append(new_camp)
            created += 1

    CAMPS_PATH.write_text(json.dumps(camps, indent=2, ensure_ascii=False) + "\n")
    print(
        json.dumps(
            {
                "camps": len(camps),
                "locations": len(locs),
                "matched": matched,
                "updated": updated,
                "created": created,
                "skipped_man": skipped_man,
                "unmatched_sample": unmatched_locs[:25],
                "unmatched_count_before_create": len(unmatched_locs),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
