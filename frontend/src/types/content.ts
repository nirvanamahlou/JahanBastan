export type PublishedStatus = "published" | "draft";

export type Media = {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
};

export type TourSummary = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  durationDays: number;
  priceLabel: string;
  image: Media | null;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};
