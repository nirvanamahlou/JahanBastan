export type PublicationStatus = "draft" | "published" | "archived";

export interface ManagedDestination {
  id: number;
  title: string;
  slug: string;
  country: string;
  city: string | null;
  summary: string;
  description: string;
  attractions: string | null;
  bestTravelTime: string | null;
  travelTips: string | null;
  imageId: number | null;
  galleryImageIds: number[];
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  status: PublicationStatus;
  publishedAt: string | null;
  internalNote: string | null;
}

export interface MediaAsset {
  id: number;
  storageKey: string;
  originalName: string;
}

export interface ManagedCountry {
  id: number;
  name: string;
  slug: string;
  imageId: number | null;
  galleryImageIds: number[];
  displayOrder: number;
  status: PublicationStatus;
  publishedAt: string | null;
  internalNote: string | null;
}
