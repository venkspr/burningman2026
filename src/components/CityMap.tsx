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

  return (
    <div className="city-map">
      <div className="city-map-layout">
        <div className="city-map-main">
          <div className="city-map-stage city-map-stage-art is-dense">
            <div className="city-map-world city-map-world-static">
              <BrcArtMap />

              {markers.map((m) => {
                const hot = effectiveId === m.camp.id;
                return (
                  <button
                    key={m.camp.id}
                    type="button"
                    className={`map-pin ${hot ? "is-hot" : ""} ${
                      m.placement.approximate ? "is-approx" : ""
                    } ${
                      m.camp.placementSource === "directory"
                        ? "is-directory"
                        : ""
                    }`}
                    style={{ left: `${m.x}%`, top: `${m.y}%` }}
                    aria-label={`${m.camp.name} at ${m.placement.label}`}
                    aria-pressed={hot}
                    onClick={() => focusMarker(m)}
                    title={`${m.camp.name} — ${m.placement.label}`}
                  >
                    <span className="map-pin-halo" aria-hidden />
                    <span className="map-pin-badge" />
                  </button>
                );
              })}

              {selected && (
                <div
                  className="map-pin-callout"
                  style={{
                    left: `${Math.min(Math.max(selected.x, 22), 78)}%`,
                    top: `${Math.max(selected.y - 7, 6)}%`,
                  }}
                >
                  {selected.camp.name}
                </div>
              )}
            </div>
          </div>
          <p className="city-map-hint">
            {markers.length} camps pinned. Click a dot for the name — addresses
            from Playa Info / sheet may not be final 2026 placement.
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

