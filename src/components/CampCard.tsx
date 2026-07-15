import type { Camp, CampAmenities } from "../data/types";
import {
  formatDues,
  formatSize,
  hasCommunal,
  truncate,
} from "../data/utils";

const QUICK_AMENITIES: (keyof CampAmenities)[] = [
  "shade",
  "power",
  "water",
  "shower",
  "kitchen",
  "food",
];

type Props = {
  camp: Camp;
  active: boolean;
  onSelect: (camp: Camp) => void;
};

export function CampCard({ camp, active, onSelect }: Props) {
  const communal = QUICK_AMENITIES.filter((k) => hasCommunal(camp, k));

  return (
    <button
      type="button"
      className={`camp-card ${active ? "is-active" : ""}`}
      onClick={() => onSelect(camp)}
    >
      <div className="camp-card-top">
        <h3 className="camp-name">{camp.name}</h3>
        <span className="camp-dues">{formatDues(camp)}</span>
      </div>
      <p className="camp-blurb">{truncate(camp.description, 180)}</p>
      <div className="meta-row">
        <span className="meta-pill">{formatSize(camp)}</span>
        {camp.placement && (
          <span className="meta-pill">{camp.placement}</span>
        )}
        {(camp.hometown || camp.cities) && (
          <span className="meta-pill">{camp.hometown || camp.cities}</span>
        )}
        {camp.acceptingCampers && (
          <span className="meta-pill">Welcoming campers</span>
        )}
        {camp.scholarship === "yes" && (
          <span className="meta-pill">Scholarships</span>
        )}
        {camp.scholarship === "maybe" && (
          <span className="meta-pill">Maybe aid</span>
        )}
      </div>
      {communal.length > 0 && (
        <div className="amenity-dots">
          {communal.slice(0, 5).map((k) => (
            <span key={k} className="amenity-dot">
              {k === "greyWater" ? "grey water" : k}
            </span>
          ))}
          {communal.length > 5 && (
            <span className="amenity-dot partial">+{communal.length - 5}</span>
          )}
        </div>
      )}
    </button>
  );
}
