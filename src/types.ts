export type StemType = "drums" | "bass" | "vocals" | "other";

export interface Stem {
  id: string;
  name: string;
  type: StemType;
  blob: Blob;
  colorIndex: number;
}

export interface Song {
  id: string;
  name: string;
  dateAdded: number;
  stems: Stem[];
}

export type Volumes = Record<string, number>;

export type Mutes = Record<string, boolean>;
