export type AmenityValue = "communal" | "individual" | "both" | "na";

export type ScholarshipValue = "yes" | "no" | "maybe";

export type PlacementSource = "user" | "sheet" | "directory" | "";

export interface CampAmenities {
  transport: AmenityValue;
  housing: AmenityValue;
  shade: AmenityValue;
  power: AmenityValue;
  water: AmenityValue;
  shower: AmenityValue;
  kitchen: AmenityValue;
  food: AmenityValue;
  greyWater: AmenityValue;
  waste: AmenityValue;
}

export interface Camp {
  id: string;
  name: string;
  email: string;
  website: string;
  description: string;
  size: string;
  sizeMin: number;
  sizeMax: number;
  amenities: CampAmenities;
  duties: string;
  dues: string;
  duesMin: number | null;
  scholarship: ScholarshipValue;
  cities: string;
  hometown?: string;
  placement: string;
  placementSource?: PlacementSource;
  directoryUrl?: string;
  acceptingCampers?: boolean;
  officialListed?: boolean;
  tags: string[];
}
