import { useMemo, useState } from "react";
import type { Camp } from "../data/types";
import { campsToMarkers, type MapMarker } from "../data/brcMap";
import {
  ensureUrl,
  formatDues,
  formatSize,
  truncate,
} from "../data/utils";
import { BrcArtMap } from "./BrcArtMap";

type Props = {
  camps: Camp[];
  onOpenCamp: (camp: Camp) => void;
};

export function CityMap({ camps, onOpenCamp }: Props) {
  const markers = useMemo(() => campsToMarkers(camps), [camps]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected: MapMarker | null =
    markers.find((m) => m.camp.id === selectedId) ??
    markers[0] ??
    null;

  const effectiveId = selected?.camp.id ?? null;
  const site = selected ? ensureUrl(selected.camp.website) : "";

  const focusMarker = (m: MapMarker) => setSelectedId(m.camp.id);

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

              {/* Same viewBox + meet as the art map so pins track the map at any width */}
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
            {markers.length} camps pinned. Click a dot for the name — 2026
            placement addresses where available.
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
            <h3 className="map-roster-title">
              On the map <span>{markers.length}</span>
            </h3>
            <ul className="map-roster-list">
              {markers.map((m) => (
                <li key={m.camp.id}>
                  <button
                    type="button"
                    className={`map-roster-item ${
                      effectiveId === m.camp.id ? "is-active" : ""
                    }`}
                    onClick={() => focusMarker(m)}
                  >
                    <span className="map-roster-num" aria-hidden>
                      •
                    </span>
                    <span className="map-roster-text">
                      <span className="map-roster-name">{m.camp.name}</span>
                      <span className="map-roster-loc">{m.placement.label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
