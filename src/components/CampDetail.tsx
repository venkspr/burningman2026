import type { Camp } from "../data/types";
import {
  AMENITY_KEYS,
  AMENITY_LABELS,
  ensureUrl,
  formatAmenity,
  formatDues,
  formatSize,
} from "../data/utils";

type Props = {
  camp: Camp;
  onClose: () => void;
};

export function CampDetail({ camp, onClose }: Props) {
  const site = ensureUrl(camp.website);

  return (
    <>
      <div
        className="detail-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="detail-panel is-pinned"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camp-detail-title"
      >
        <div className="detail-panel-chrome">
          <p className="detail-hint">Esc or × to close</p>
          <button
            type="button"
            className="detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <h2 id="camp-detail-title" className="detail-title">
          {camp.name}
        </h2>
        <p className="detail-desc">{camp.description}</p>

        <div className="detail-actions">
          {camp.email && (
            <a className="btn btn-primary" href={`mailto:${camp.email}`}>
              Email camp
            </a>
          )}
          {site && (
            <a
              className="btn btn-ghost"
              href={site}
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
          )}
        </div>

        <div className="meta-row" style={{ marginBottom: "1rem" }}>
          <span className="meta-pill">{formatSize(camp)}</span>
          <span className="meta-pill">{formatDues(camp)}</span>
          {camp.scholarship !== "no" && (
            <span className="meta-pill">
              Scholarship: {camp.scholarship}
            </span>
          )}
          {camp.placement && (
            <span className="meta-pill">📍 {camp.placement}</span>
          )}
        </div>

        <section className="detail-section">
          <h3>Dues</h3>
          <p>{camp.dues || "Not listed — ask the camp."}</p>
        </section>

        <section className="detail-section">
          <h3>Responsibilities</h3>
          <p>{camp.duties || "Not listed — ask the camp."}</p>
        </section>

        <section className="detail-section">
          <h3>Amenities</h3>
          <dl className="amenity-table">
            {AMENITY_KEYS.map((key) => (
              <div key={key} style={{ display: "contents" }}>
                <dt>{AMENITY_LABELS[key]}</dt>
                <dd>{formatAmenity(camp.amenities[key])}</dd>
              </div>
            ))}
          </dl>
        </section>

        {camp.cities && (
          <section className="detail-section">
            <h3>Where campmates are</h3>
            <p>{camp.cities}</p>
          </section>
        )}

        {camp.tags.length > 0 && (
          <section className="detail-section">
            <h3>Tags</h3>
            <div className="tag-list">
              {camp.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}
      </aside>
    </>
  );
}
