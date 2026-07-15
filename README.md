# Campways — BRC 2026 Camp Seekers

Unofficial navigational site for Burning Man 2026 theme camps.

## Data sources

| Source | What we use |
|--------|-------------|
| [burningman.org 2026 camps](https://burningman.org/black-rock-city/black-rock-city-2026/2026-camps/) | Names, descriptions, hometowns, “welcoming campers” |
| [Playa Info directory](https://directory.burningman.org/camps/) | Clock/street addresses when listed (often prior / provisional) |
| Seeking-campers sheet | Dues, amenities, duties for camps that posted openings |
| You | Manual pins (e.g. Sound Garden @ 2:00 & Eternal) |

**Official 2026 placement coordinates** are gated by Burning Man Innovate until ~Aug 9 for developers / ~Aug 23 public ([schedule](https://innovate.burningman.org/apis-page/)). Treat map pins as provisional until then.

## Refresh listings

```bash
python3 scripts/refresh_bm_listings.py
```

Keeps `camps_seeking_backup.json` for amenity/dues merge.

## Run locally

```bash
npm install
npm run dev
```
