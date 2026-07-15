#!/usr/bin/env python3
"""Refresh official BM 2026 camp listing + Playa Info directory locations.

Official clock/street placements are not published by Burning Man until
~3 weeks before the event (see innovate.burningman.org/apis-page/).
Directory addresses are self-reported / prior and may be stale.
"""

from __future__ import annotations

import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
OFFICIAL_URL = "https://burningman.org/black-rock-city/black-rock-city-2026/2026-camps/"

USER_PLACEMENTS = {
    "sound garden": "2:00 & Eternal",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "CampwaysBot/1.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "ignore")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", unescape(s or ""))).strip()


def norm_name(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"^the\s+", "", s)
    s = re.sub(r"^camp\s+", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def fetch_official() -> list[dict]:
    html = fetch(OFFICIAL_URL)
    raw_items = re.findall(r'data-item-data="(\{.*?\})"', html)
    camps: list[dict] = []
    seen: set[str] = set()
    for raw in raw_items:
        try:
            obj = json.loads(unescape(raw))
        except json.JSONDecodeError:
            continue
        name = (obj.get("name") or "").strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        camps.append(
            {
                "name": name,
                "slug": obj.get("_anchor") or "",
                "acceptingCampers": bool(obj.get("accepting_campers")),
                "hometown": (obj.get("hometown") or "").strip(),
                "description": (obj.get("description") or "").strip(),
                "source": "burningman.org/2026-camps",
            }
        )
    return camps


def scrape_directory() -> list[dict]:
    letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["other"]
    links: set[str] = set()
    for letter in letters:
        page = 1
        while page <= 30:
            url = (
                f"https://directory.burningman.org/camps/browse/{letter}/"
                if page == 1
                else f"https://directory.burningman.org/camps/browse/{letter}/?page={page}"
            )
            html = fetch(url)
            found = set(re.findall(r'href="(/camps/\d+)/?"', html))
            if not found and page > 1:
                break
            links |= found
            if len(found) < 50:
                break
            page += 1

    def one(path: str) -> dict:
        url = "https://directory.burningman.org" + path.rstrip("/") + "/"
        page = fetch(url)
        name_m = re.search(r"<h1[^>]*>\s*(?:Camp:\s*)?(.*?)</h1>", page, re.S | re.I)
        loc_m = re.search(r"Location:\s*<tt>(.*?)</tt>", page, re.S | re.I)
        desc_m = re.search(
            r"<h2>\s*Description:\s*</h2>\s*<p>(.*?)</p>", page, re.S | re.I
        )
        return {
            "id": path.strip("/").split("/")[-1],
            "name": clean(name_m.group(1) if name_m else ""),
            "placement": clean(loc_m.group(1) if loc_m else "").replace("&amp;", "&"),
            "description": clean(desc_m.group(1) if desc_m else ""),
            "url": url,
        }

    out: list[dict] = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futs = [pool.submit(one, p) for p in sorted(links)]
        for fut in as_completed(futs):
            out.append(fut.result())
    return out


def fuzzy_find(name: str, mapping: dict, cutoff: float = 0.92):
    n = norm_name(name)
    if n in mapping:
        return mapping[n]
    best, best_sc = None, 0.0
    for key, value in mapping.items():
        score = SequenceMatcher(None, n, key).ratio()
        if score > best_sc:
            best, best_sc = value, score
    return best if best_sc >= cutoff else None


def main() -> None:
    print("Fetching official 2026 camps…")
    official = fetch_official()
    (DATA / "bm_official_camps_2026.json").write_text(
        json.dumps(official, indent=2, ensure_ascii=False) + "\n"
    )
    print(f"  {len(official)} camps")

    print("Scraping Playa Info directory locations…")
    directory = scrape_directory()
    (DATA / "directory_camps.json").write_text(
        json.dumps(directory, indent=2, ensure_ascii=False) + "\n"
    )
    print(f"  {len(directory)} camps, {sum(1 for d in directory if d['placement'])} with addresses")

    seeking_path = DATA / "camps_seeking_backup.json"
    seeking = (
        json.loads(seeking_path.read_text())
        if seeking_path.exists()
        else json.loads((DATA / "camps.json").read_text())
    )

    dir_map = {norm_name(d["name"]): d for d in directory}
    seek_map = {norm_name(c["name"]): c for c in seeking}
    empty = {
        k: "na"
        for k in [
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
    }

    merged: list[dict] = []
    for o in official:
        s = fuzzy_find(o["name"], seek_map)
        d = fuzzy_find(o["name"], dir_map)
        n = norm_name(o["name"])

        placement, source = "", ""
        if n in USER_PLACEMENTS or n.replace("the ", "") in USER_PLACEMENTS:
            key = n if n in USER_PLACEMENTS else n.replace("the ", "")
            # also try trailing
            for uk, uv in USER_PLACEMENTS.items():
                if uk in n or n in uk:
                    placement, source = uv, "user"
                    break
        if not placement and s and s.get("placement"):
            placement, source = s["placement"], "sheet"
        if not placement and d and d.get("placement"):
            placement, source = d["placement"], "directory"

        if s:
            camp = dict(s)
            if o.get("description"):
                camp["description"] = o["description"]
            camp["hometown"] = o.get("hometown") or camp.get("cities") or ""
            camp["cities"] = camp.get("cities") or camp["hometown"]
            camp["acceptingCampers"] = bool(o.get("acceptingCampers"))
            camp["officialListed"] = True
        else:
            camp = {
                "id": slugify(o["name"]),
                "name": o["name"],
                "email": "",
                "website": (d or {}).get("url", ""),
                "description": o.get("description") or (d or {}).get("description") or "",
                "size": "",
                "sizeMin": 0,
                "sizeMax": 0,
                "amenities": dict(empty),
                "duties": "",
                "dues": "",
                "duesMin": None,
                "scholarship": "no",
                "cities": o.get("hometown") or "",
                "hometown": o.get("hometown") or "",
                "tags": [],
                "acceptingCampers": bool(o.get("acceptingCampers")),
                "officialListed": True,
            }

        camp["placement"] = placement
        camp["placementSource"] = source
        if d and d.get("url"):
            camp["directoryUrl"] = d["url"]
        merged.append(camp)

    official_norms = {norm_name(c["name"]) for c in merged}
    for s in seeking:
        if norm_name(s["name"]) in official_norms:
            continue
        camp = dict(s)
        camp["officialListed"] = False
        camp["acceptingCampers"] = True
        camp.setdefault("hometown", camp.get("cities", ""))
        camp["placementSource"] = "sheet" if camp.get("placement") else ""
        merged.append(camp)

    merged.sort(key=lambda c: c["name"].lower())
    seen: dict[str, int] = {}
    for camp in merged:
        base = camp.get("id") or slugify(camp["name"])
        if base in seen:
            seen[base] += 1
            camp["id"] = f"{base}-{seen[base]}"
        else:
            seen[base] = 1
            camp["id"] = base

    (DATA / "camps.json").write_text(
        json.dumps(merged, indent=2, ensure_ascii=False) + "\n"
    )
    placed = sum(1 for c in merged if c.get("placement"))
    print(f"Wrote {len(merged)} camps ({placed} with addresses) → src/data/camps.json")


if __name__ == "__main__":
    main()
