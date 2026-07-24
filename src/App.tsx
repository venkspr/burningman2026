import { useEffect, useMemo, useState } from "react";
import campsData from "./data/camps.json";
import type { Camp, CampAmenities, ScholarshipValue } from "./data/types";
import { AMENITY_LABELS, TAG_OPTIONS } from "./data/utils";
import { CampCard } from "./components/CampCard";
import { CampDetail } from "./components/CampDetail";
import { CityMap } from "./components/CityMap";
import "./App.css";

const camps = campsData as Camp[];
const PAGE_SIZE = 24;

type SortKey = "name" | "dues-asc" | "dues-desc" | "size-asc" | "size-desc";

type Filters = {
  query: string;
  amenity: keyof CampAmenities | "";
  scholarship: ScholarshipValue | "";
  tag: string;
  maxDues: string;
  maxSize: string;
  placementOnly: boolean;
  acceptingOnly: boolean;
};

const defaultFilters: Filters = {
  query: "",
  amenity: "",
  scholarship: "",
  tag: "",
  maxDues: "",
  maxSize: "",
  placementOnly: false,
  acceptingOnly: false,
};

function matchesQuery(camp: Camp, q: string): boolean {
  if (!q) return true;
  const hay = [
    camp.name,
    camp.description,
    camp.cities,
    camp.hometown ?? "",
    camp.duties,
    camp.dues,
    camp.placement,
    ...camp.tags,
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token));
}

function sortCamps(list: Camp[], sort: SortKey): Camp[] {
  const copy = [...list];
  switch (sort) {
    case "dues-asc":
      return copy.sort(
        (a, b) => (a.duesMin ?? 99999) - (b.duesMin ?? 99999),
      );
    case "dues-desc":
      return copy.sort(
        (a, b) => (b.duesMin ?? -1) - (a.duesMin ?? -1),
      );
    case "size-asc":
      return copy.sort((a, b) => a.sizeMin - b.sizeMin);
    case "size-desc":
      return copy.sort((a, b) => b.sizeMax - a.sizeMax);
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Camp | null>(null);

  const placedCamps = useMemo(
    () => camps.filter((c) => c.placement.trim().length > 0),
    [],
  );

  const filtered = useMemo(() => {
    const maxDues = filters.maxDues ? Number(filters.maxDues) : null;
    const maxSize = filters.maxSize ? Number(filters.maxSize) : null;

    const list = camps.filter((camp) => {
      if (!matchesQuery(camp, filters.query)) return false;

      if (filters.acceptingOnly && !camp.acceptingCampers) return false;

      if (filters.amenity) {
        const v = camp.amenities[filters.amenity];
        if (v !== "communal" && v !== "both") return false;
      }

      if (filters.scholarship) {
        if (camp.scholarship !== filters.scholarship) return false;
      }

      if (filters.tag) {
        if (!camp.tags.map((t) => t.toLowerCase()).includes(filters.tag)) {
          return false;
        }
      }

      if (maxDues != null && !Number.isNaN(maxDues)) {
        if (camp.duesMin == null || camp.duesMin > maxDues) return false;
      }

      if (maxSize != null && !Number.isNaN(maxSize)) {
        if (camp.sizeMin > maxSize) return false;
      }

      if (filters.placementOnly && !camp.placement.trim()) return false;

      return true;
    });

    return sortCamps(list, sort);
  }, [filters, sort]);

  const mapCamps = useMemo(
    () => filtered.filter((c) => c.placement.trim().length > 0),
    [filtered],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [filters, sort]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#map">
          <span className="brand-mark">Campways</span>
          <span className="brand-year">BRC 2026</span>
        </a>
        <nav className="nav-links">
          <a href="#map">Map</a>
          <a href="#browse">Camps</a>
        </nav>
      </header>

      <section className="map-section map-section-landing" id="map">
        <div className="map-section-header">
          <h2>Black Rock City 2026</h2>
          <p>
            Search and filter first — pins update live ({mapCamps.length} with
            addresses). Placements from the 2026 city layout; always confirm with
            the camp.
          </p>
        </div>

        <aside className="filters map-filters" aria-label="Camp filters">
          <div className="map-filters-top">
            <div className="filter-group map-filters-search">
              <label htmlFor="search">Search</label>
              <input
                id="search"
                type="search"
                placeholder="slushies, queer, Reno…"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
              />
            </div>
            <div className="filter-group">
              <span className="filter-label">Camp supplies</span>
              <select
                value={filters.amenity}
                onChange={(e) =>
                  update("amenity", e.target.value as Filters["amenity"])
                }
              >
                <option value="">Any amenity</option>
                {(
                  Object.keys(AMENITY_LABELS) as (keyof CampAmenities)[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {AMENITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="maxDues">Max dues ($)</label>
              <input
                id="maxDues"
                type="number"
                min={0}
                step={50}
                placeholder="e.g. 500"
                value={filters.maxDues}
                onChange={(e) => update("maxDues", e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="maxSize">Max camp size</label>
              <input
                id="maxSize"
                type="number"
                min={0}
                placeholder="e.g. 40"
                value={filters.maxSize}
                onChange={(e) => update("maxSize", e.target.value)}
              />
            </div>
            <div className="filter-group">
              <span className="filter-label">Sort list</span>
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="name">A–Z</option>
                <option value="dues-asc">Dues ↑</option>
                <option value="dues-desc">Dues ↓</option>
                <option value="size-asc">Size ↑</option>
                <option value="size-desc">Size ↓</option>
              </select>
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Financial aid</span>
            <div className="chip-row">
              {(
                [
                  ["", "Any"],
                  ["yes", "Yes"],
                  ["maybe", "Maybe"],
                  ["no", "No"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={label}
                  type="button"
                  className={`chip ${filters.scholarship === val ? "active" : ""}`}
                  onClick={() => update("scholarship", val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Vibe tags</span>
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${filters.tag === "" ? "active" : ""}`}
                onClick={() => update("tag", "")}
              >
                All
              </button>
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`chip ${filters.tag === tag ? "active" : ""}`}
                  onClick={() =>
                    update("tag", filters.tag === tag ? "" : tag)
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="map-filters-actions">
            <button
              type="button"
              className={`chip ${filters.acceptingOnly ? "active" : ""}`}
              onClick={() =>
                update("acceptingOnly", !filters.acceptingOnly)
              }
            >
              Welcoming campers
            </button>
            <button
              type="button"
              className={`chip ${filters.placementOnly ? "active" : ""}`}
              onClick={() =>
                update("placementOnly", !filters.placementOnly)
              }
            >
              Has address
            </button>
            <button
              type="button"
              className="clear-filters clear-filters-inline"
              onClick={() => setFilters(defaultFilters)}
            >
              Clear filters
            </button>
            <p className="map-filters-count">
              <span>{filtered.length}</span> camps ·{" "}
              <span>{mapCamps.length}</span> on map
            </p>
          </div>
        </aside>

        <CityMap camps={mapCamps} onOpenCamp={setSelected} />

        {placedCamps.length > 0 && filters.acceptingOnly === false && (
          <div className="map-placed">
            <h3>All known addresses ({placedCamps.length})</h3>
            <ul className="placed-list">
              {placedCamps.slice(0, 40).map((camp) => (
                <li key={camp.id}>
                  <button type="button" onClick={() => setSelected(camp)}>
                    <span>{camp.name}</span>
                    <span className="placed-loc">{camp.placement}</span>
                  </button>
                </li>
              ))}
            </ul>
            {placedCamps.length > 40 && (
              <p className="city-map-hint">
                Showing 40 of {placedCamps.length} — use search/filters for the
                rest.
              </p>
            )}
          </div>
        )}
      </section>

      <p className="disclaimer">
        <strong>Unofficial guide.</strong> Listings from{" "}
        <a
          href="https://burningman.org/black-rock-city/black-rock-city-2026/2026-camps/"
          target="_blank"
          rel="noreferrer"
        >
          burningman.org
        </a>
        ; map pins use 2026 placement addresses where available. Always verify
        with the camp before you go.{" "}
        <a href="mailto:placement@burningman.org">placement@burningman.org</a>
      </p>

      <div className="browse browse-results-only" id="browse">
        <main className="results">
          <div className="results-bar">
            <h2 className="results-count">
              <span>{filtered.length}</span> camps matching filters
            </h2>
            {filtered.length > 0 && (
              <p className="results-page-meta">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>
                No camps match those filters. Loosen the search above the map
                and try again.
              </p>
            </div>
          ) : (
            <>
              <div className="camp-grid">
                {pageItems.map((camp) => (
                  <CampCard
                    key={camp.id}
                    camp={camp}
                    active={selected?.id === camp.id}
                    onSelect={setSelected}
                  />
                ))}
              </div>

              {pageCount > 1 && (
                <nav className="pagination" aria-label="Camp list pages">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={safePage <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      document
                        .getElementById("browse")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Previous
                  </button>

                  <div className="pagination-pages">
                    {Array.from({ length: pageCount }, (_, i) => i + 1)
                      .filter((n) => {
                        if (pageCount <= 7) return true;
                        if (n === 1 || n === pageCount) return true;
                        return Math.abs(n - safePage) <= 1;
                      })
                      .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                        if (idx > 0) {
                          const prev = arr[idx - 1];
                          if (n - prev > 1) acc.push("…");
                        }
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "…" ? (
                          <span key={`e-${idx}`} className="pagination-ellipsis">
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            className={`pagination-btn pagination-num ${
                              item === safePage ? "is-active" : ""
                            }`}
                            aria-current={
                              item === safePage ? "page" : undefined
                            }
                            onClick={() => {
                              setPage(item);
                              document
                                .getElementById("browse")
                                ?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            {item}
                          </button>
                        ),
                      )}
                  </div>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={safePage >= pageCount}
                    onClick={() => {
                      setPage((p) => Math.min(pageCount, p + 1));
                      document
                        .getElementById("browse")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="site-footer">
        <p>
          Campways is an unofficial navigational aid for BRC 2026. Always verify
          details with the camp before committing.
        </p>
        <p>
          Reach Burning Man Placement at{" "}
          <a href="mailto:placement@burningman.org">placement@burningman.org</a>.
        </p>
      </footer>

      {selected && (
        <CampDetail camp={selected} onClose={() => setSelected(null)} />
      )}

      <style>{`
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
      `}</style>
    </>
  );
}
