import { useEffect, useMemo, useRef, useState } from "react";
import type { Camp } from "../data/types";
import { campsToMarkers, type MapMarker } from "../data/brcMap";
import {
  ensureUrl,
  formatDues,
  formatSize,
  truncate,
} from "../data/utils";
import { compactText } from "../data/nlSearch";
import { BrcArtMap } from "./BrcArtMap";

type Props = {
  camps: Camp[];
  onOpenCamp: (camp: Camp) => void;
};

type RosterGroup = "clock" | "alpha";

const HOUR_JUMPS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function clockBucket(m: MapMarker): string {
  if (m.placement.centerCamp) return "Center Camp";
  const h = m.placement.hour;
  // Snap to nearest hour label used in BRC (2–10)
  const snapped = Math.min(10, Math.max(2, h === 12 || h === 1 ? 2 : h));
  return `${snapped}:00`;
}

function clockSortKey(m: MapMarker): number {
  if (m.placement.centerCamp) return 6 * 60 + 30;
  return m.placement.hour * 60 + m.placement.minute;
}

export function CityMap({ camps, onOpenCamp }: Props) {
  const markers = useMemo(() => campsToMarkers(camps), [camps]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [groupBy, setGroupBy] = useState<RosterGroup>("clock");
  const listRef = useRef<HTMLDivElement>(null);

  const selected: MapMarker | null =
    markers.find((m) => m.camp.id === selectedId) ??
    markers[0] ??
    null;

  const effectiveId = selected?.camp.id ?? null;
  const site = selected ? ensureUrl(selected.camp.website) : "";

  const focusMarker = (m: MapMarker) => {
    setSelectedId(m.camp.id);
    // Scroll roster row into view
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-camp-id="${m.camp.id}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const filteredMarkers = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    if (!q) return markers;
    const compactQ = compactText(q);
    return markers.filter((m) => {
      const hay = `${m.camp.name} ${m.placement.label}`.toLowerCase();
      const compactHay = compactText(hay);
      if (compactQ.length >= 3 && compactHay.includes(compactQ)) return true;
      const normalized = q.replace(/[-_./]+/g, " ");
      return normalized.split(/\s+/).every(
        (t) => hay.includes(t) || compactHay.includes(compactText(t)),
      );
    });
  }, [markers, rosterQuery]);

  const grouped = useMemo(() => {
    if (groupBy === "alpha") {
      const sorted = [...filteredMarkers].sort((a, b) =>
        a.camp.name.localeCompare(b.camp.name),
      );
      const buckets = new Map<string, MapMarker[]>();
      for (const m of sorted) {
        const letter = (m.camp.name[0] ?? "#").toUpperCase();
        const key = /[A-Z]/.test(letter) ? letter : "#";
        const list = buckets.get(key) ?? [];
        list.push(m);
        buckets.set(key, list);
      }
      return [...buckets.entries()];
    }

    const sorted = [...filteredMarkers].sort(
      (a, b) =>
        clockSortKey(a) - clockSortKey(b) ||
        a.camp.name.localeCompare(b.camp.name),
    );
    const buckets = new Map<string, MapMarker[]>();
    for (const m of sorted) {
      const key = clockBucket(m);
      const list = buckets.get(key) ?? [];
      list.push(m);
      buckets.set(key, list);
    }
    return [...buckets.entries()];
  }, [filteredMarkers, groupBy]);

  const jumpToHour = (hour: number) => {
    setGroupBy("clock");
    setRosterQuery("");
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-hour-group="${hour}:00"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  // Keep selection valid when filter changes
  useEffect(() => {
    if (!selectedId) return;
    if (!markers.some((m) => m.camp.id === selectedId)) {
      setSelectedId(markers[0]?.camp.id ?? null);
    }
  }, [markers, selectedId]);

  const calloutX = selected
    ? Math.min(Math.max(selected.x, 18), 82)
    : 50;
  const calloutY = selected ? Math.max(selected.y - 4.5, 6) : 0;

  return (
    <div className="city-map">
      <div className="city-map-layout">
        <div className="city-map-main">
          <div className="city-map-stage city-map-stage-art is-dense">
            <div className="city-map-world city-map-world-static">
              <BrcArtMap />

              <svg
                className="brc-pin-layer"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                role="group"
                aria-label="Camp locations on the map"
              >
                {markers.map((m) => {
                  const hot = effectiveId === m.camp.id;
                  const kind =
                    m.camp.placementSource === "directory"
                      ? "directory"
                      : m.placement.approximate
                        ? "approx"
                        : m.camp.placementSource === "official"
                          ? "sheet"
                          : "sheet";
                  return (
                    <g
                      key={m.camp.id}
                      className={`map-pin-svg ${hot ? "is-hot" : ""} is-${kind}`}
                      transform={`translate(${m.x} ${m.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${m.camp.name} at ${m.placement.label}`}
                      aria-pressed={hot}
                      onClick={() => focusMarker(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          focusMarker(m);
                        }
                      }}
                    >
                      <title>{`${m.camp.name} — ${m.placement.label}`}</title>
                      <circle className="map-pin-svg-halo" r="2.4" />
                      <circle className="map-pin-svg-hit" r="2.1" />
                      <circle className="map-pin-svg-dot" r="1.05" />
                    </g>
                  );
                })}

                {selected && (
                  <g
                    className="map-pin-svg-callout"
                    transform={`translate(${calloutX} ${calloutY})`}
                    pointerEvents="none"
                  >
                    <rect
                      className="map-pin-svg-callout-bg"
                      x={-14}
                      y={-3.2}
                      width={28}
                      height={4.4}
                      rx={0.6}
                    />
                    <text
                      className="map-pin-svg-callout-text"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      y={-1}
                    >
                      {selected.camp.name.length > 28
                        ? `${selected.camp.name.slice(0, 27)}…`
                        : selected.camp.name}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
          <p className="city-map-hint">
            {markers.length} camps pinned. Use the address guide to jump by
            clock time — click a row to light the pin.
          </p>
        </div>

        <aside className="city-map-side">
          {selected ? (
            <div className="map-side-card">
              <p className="map-hover-loc">
                {selected.placement.label}
                {selected.camp.placementSource
                  ? ` · ${selected.camp.placementSource}`
                  : ""}
              </p>
              <h3 className="map-hover-name">{selected.camp.name}</h3>
              <p className="map-hover-blurb">
                {truncate(
                  selected.camp.description || "No description yet.",
                  280,
                )}
              </p>
              <div className="meta-row">
                {(selected.camp.hometown || selected.camp.cities) && (
                  <span className="meta-pill">
                    {selected.camp.hometown || selected.camp.cities}
                  </span>
                )}
                {selected.camp.size && (
                  <span className="meta-pill">{formatSize(selected.camp)}</span>
                )}
                {selected.camp.duesMin != null && (
                  <span className="meta-pill">{formatDues(selected.camp)}</span>
                )}
                {selected.camp.acceptingCampers && (
                  <span className="meta-pill">Welcoming campers</span>
                )}
              </div>
              <div className="map-hover-actions">
                {selected.camp.email && (
                  <a
                    className="btn btn-primary"
                    href={`mailto:${selected.camp.email}`}
                  >
                    Email
                  </a>
                )}
                {site && (
                  <a
                    className="btn btn-ghost"
                    href={site}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Site
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onOpenCamp(selected.camp)}
                >
                  Full details
                </button>
              </div>
            </div>
          ) : (
            <div className="map-side-card map-side-empty">
              <p>No camps with parseable addresses in this filter.</p>
            </div>
          )}

          <div className="map-roster">
            <div className="map-roster-header">
              <h3 className="map-roster-title">
                Address guide <span>{filteredMarkers.length}</span>
              </h3>
              <label className="map-roster-search">
                <span className="visually-hidden">Search addresses</span>
                <input
                  type="search"
                  placeholder="Search name or address…"
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                />
              </label>
              <div className="map-roster-tools">
                <div className="map-roster-group-toggle" role="group" aria-label="Group by">
                  <button
                    type="button"
                    className={groupBy === "clock" ? "is-active" : ""}
                    onClick={() => setGroupBy("clock")}
                  >
                    By clock
                  </button>
                  <button
                    type="button"
                    className={groupBy === "alpha" ? "is-active" : ""}
                    onClick={() => setGroupBy("alpha")}
                  >
                    A–Z
                  </button>
                </div>
              </div>
              {groupBy === "clock" && (
                <div className="map-roster-jumps" aria-label="Jump to clock hour">
                  {HOUR_JUMPS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className="map-roster-jump"
                      onClick={() => jumpToHour(h)}
                    >
                      {h}:00
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="map-roster-scroll" ref={listRef}>
              {filteredMarkers.length === 0 ? (
                <p className="map-roster-empty">
                  No addresses match “{rosterQuery}”.
                </p>
              ) : (
                grouped.map(([label, items]) => (
                  <section
                    key={label}
                    className="map-roster-group"
                    data-hour-group={label}
                  >
                    <h4 className="map-roster-group-title">
                      {label}
                      <span>{items.length}</span>
                    </h4>
                    <ul className="map-roster-list">
                      {items.map((m) => (
                        <li key={m.camp.id}>
                          <button
                            type="button"
                            data-camp-id={m.camp.id}
                            className={`map-roster-item ${
                              effectiveId === m.camp.id ? "is-active" : ""
                            }`}
                            onClick={() => focusMarker(m)}
                          >
                            <span className="map-roster-num" aria-hidden>
                              •
                            </span>
                            <span className="map-roster-text">
                              <span className="map-roster-name">
                                {m.camp.name}
                              </span>
                              <span className="map-roster-loc">
                                {m.placement.label}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
