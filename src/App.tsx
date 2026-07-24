import { useEffect, useMemo, useState } from "react";
import campsData from "./data/camps.json";
import type { Camp, CampAmenities, ScholarshipValue } from "./data/types";
import {
  interpretQuery,
  matchesNameQuery,
  matchesNearCamp,
  matchesNlPlacement,
  NL_EXAMPLES,
  scoreCamp,
  compactText,
} from "./data/nlSearch";
import { AMENITY_LABELS, TAG_OPTIONS } from "./data/utils";
import { CampCard } from "./components/CampCard";
import { CampDetail } from "./components/CampDetail";
import { CityMap } from "./components/CityMap";
import "./App.css";

const camps = campsData as Camp[];
const PAGE_SIZE = 24;

type SortKey =
  | "relevance"
  | "name"
  | "dues-asc"
  | "dues-desc"
  | "size-asc"
  | "size-desc";

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
  if (matchesNameQuery(camp, q)) return true;
  const normalized = q.replace(/[-_./]+/g, " ");
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
  const compactHay = compactText(hay);
  return normalized
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(
      (token) => hay.includes(token) || compactHay.includes(compactText(token)),
    );
}

function sortCamps(
  list: Camp[],
  sort: SortKey,
  residualQuery: string,
  nlFilters: ReturnType<typeof interpretQuery>["filters"],
  rawQuery: string,
  allCamps: Camp[],
): Camp[] {
  const copy = [...list];
  switch (sort) {
    case "relevance":
      return copy.sort(
        (a, b) =>
          scoreCamp(b, residualQuery, nlFilters, rawQuery, allCamps) -
            scoreCamp(a, residualQuery, nlFilters, rawQuery, allCamps) ||
          a.name.localeCompare(b.name),
      );
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
  const [sort, setSort] = useState<SortKey>("relevance");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Camp | null>(null);

  const nl = useMemo(
    () => interpretQuery(filters.query, camps),
    [filters.query],
  );

  const filtered = useMemo(() => {
    const amenity = filters.amenity || nl.filters.amenity;
    const scholarship = filters.scholarship || nl.filters.scholarship;
    const tag = filters.tag || nl.filters.tag;
    const maxDuesStr = filters.maxDues || nl.filters.maxDues;
    const maxSizeStr = filters.maxSize || nl.filters.maxSize;
    const acceptingOnly =
      filters.acceptingOnly || nl.filters.acceptingOnly;
    const placementOnly =
      filters.placementOnly ||
      nl.filters.placementOnly ||
      Boolean(
        nl.filters.clockHint ||
          nl.filters.streetHint ||
          nl.filters.nearCampId,
      );
    const nearActive = Boolean(nl.filters.nearCampId);

    const maxDues = maxDuesStr ? Number(maxDuesStr) : null;
    const maxSize = maxSizeStr ? Number(maxSizeStr) : null;

    const list = camps.filter((camp) => {
      const nameHit =
        !nearActive &&
        Boolean(filters.query.trim()) &&
        matchesNameQuery(camp, filters.query);

      // Direct name hits (soundgarden → The Sound Garden) bypass NL vibe/amenity guesses
      if (nameHit) {
        if (filters.acceptingOnly && !camp.acceptingCampers) return false;
        if (filters.amenity) {
          const v = camp.amenities[filters.amenity];
          if (v !== "communal" && v !== "both") return false;
        }
        if (filters.scholarship && camp.scholarship !== filters.scholarship) {
          return false;
        }
        if (
          filters.tag &&
          !camp.tags.map((t) => t.toLowerCase()).includes(filters.tag)
        ) {
          return false;
        }
        if (filters.maxDues) {
          const maxDues = Number(filters.maxDues);
          if (!Number.isNaN(maxDues)) {
            if (maxDues === 0) {
              if (camp.duesMin != null && camp.duesMin > 0) return false;
            } else if (camp.duesMin == null || camp.duesMin > maxDues) {
              return false;
            }
          }
        }
        if (filters.maxSize) {
          const maxSize = Number(filters.maxSize);
          if (!Number.isNaN(maxSize) && camp.sizeMin > maxSize) return false;
        }
        if (filters.placementOnly && !camp.placement.trim()) return false;
        return true;
      }

      if (!matchesQuery(camp, nl.residualQuery)) return false;
      if (!matchesNlPlacement(camp, nl.filters)) return false;
      if (!matchesNearCamp(camp, nl.filters, camps)) return false;

      if (acceptingOnly && !camp.acceptingCampers) return false;

      if (amenity) {
        const v = camp.amenities[amenity];
        if (v !== "communal" && v !== "both") return false;
      }

      if (scholarship) {
        if (camp.scholarship !== scholarship) return false;
      }

      if (tag) {
        const campTags = camp.tags.map((t) => t.toLowerCase());
        if (tag === "food") {
          // "food camps" = food vibe, food amenity, or food-y name/blurb
          const foodAmenity =
            camp.amenities.food === "communal" ||
            camp.amenities.food === "both" ||
            camp.amenities.kitchen === "communal" ||
            camp.amenities.kitchen === "both";
          const foodText = /food|kitchen|meal|brunch|breakfast|dinner|cafe|café|crepe|pizza|taco|grill|bakery|restaurant|tea house|teahouse/i.test(
            `${camp.name} ${camp.description}`,
          );
          if (!campTags.includes("food") && !foodAmenity && !foodText) {
            return false;
          }
        } else if (!campTags.includes(tag)) {
          return false;
        }
      }

      if (maxDues != null && !Number.isNaN(maxDues)) {
        if (maxDues === 0) {
          if (camp.duesMin != null && camp.duesMin > 0) return false;
        } else if (camp.duesMin == null || camp.duesMin > maxDues) {
          return false;
        }
      }

      if (maxSize != null && !Number.isNaN(maxSize)) {
        if (camp.sizeMin > maxSize) return false;
      }

      if (placementOnly && !camp.placement.trim()) return false;

      return true;
    });

    const effectiveSort =
      sort === "relevance" && !filters.query.trim() ? "name" : sort;

    return sortCamps(
      list,
      effectiveSort,
      nl.residualQuery,
      nl.filters,
      filters.query,
      camps,
    );
  }, [filters, sort, nl]);

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
          <div className="filter-group map-filters-search map-filters-search-nl">
            <label htmlFor="search">Ask in plain English</label>
            <input
              id="search"
              type="search"
              placeholder='e.g. “queer camp with showers under $400 near 7:00”'
              value={filters.query}
              onChange={(e) => {
                update("query", e.target.value);
                setSort("relevance");
              }}
            />
            {nl.insights.length > 0 && (
              <div className="nl-insights" aria-live="polite">
                <span className="nl-insights-label">Understood</span>
                {nl.insights.map((insight) => (
                  <span key={insight} className="nl-insight-chip">
                    {insight}
                  </span>
                ))}
                {nl.residualQuery ? (
                  <span className="nl-insight-chip nl-insight-residual">
                    keywords: {nl.residualQuery}
                  </span>
                ) : null}
              </div>
            )}
            <div className="nl-examples">
              {NL_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="nl-example"
                  onClick={() => {
                    update("query", ex);
                    setSort("relevance");
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="map-filters-top">
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
                <option value="relevance">Best match</option>
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
