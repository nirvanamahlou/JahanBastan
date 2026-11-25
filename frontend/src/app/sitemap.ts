import type { MetadataRoute } from "next";

import { apiGet } from "@/lib/api/client";
import { absoluteSiteUrl } from "@/lib/site-url";

const staticRoutes = [
  "",
  "/tours",
  "/destinations",
  "/services",
  "/services/flights",
  "/services/hotels",
  "/services/buses",
  "/services/trains",
  "/travel-guide",
  "/articles",
  "/hotels",
  "/contact",
  "/installments",
  "/privacy",
  "/terms",
  "/payment-rules",
] as const;

type SlugItem = { slug: string };
type SlugPage = { items: SlugItem[]; total?: number };

const PAGE_SIZE = 100;

async function fetchAllSlugs(path: string): Promise<SlugItem[]> {
  const items: SlugItem[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await apiGet<SlugPage>(
      `${path}${separator}pageSize=${PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store" },
    ).catch(() => null);

    if (!page) return items;
    items.push(...page.items);

    if (
      page.items.length < PAGE_SIZE ||
      (page.total !== undefined && items.length >= page.total)
    ) {
      return items;
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tours, destinations, hotels, articles, services] = await Promise.all([
    fetchAllSlugs("/tours"),
    fetchAllSlugs("/destinations"),
    fetchAllSlugs("/hotels"),
    fetchAllSlugs("/articles"),
    fetchAllSlugs("/services"),
  ]);

  const staticPages: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteSiteUrl(`${route}/`),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  const dynamicPages: MetadataRoute.Sitemap = [
    ...tours.map(({ slug }) => ({ url: absoluteSiteUrl(`/tours/${slug}/`), changeFrequency: "daily" as const, priority: 0.9 })),
    ...destinations.map(({ slug }) => ({ url: absoluteSiteUrl(`/destinations/${slug}/`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...hotels.map(({ slug }) => ({ url: absoluteSiteUrl(`/hotels/${slug}/`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...articles.map(({ slug }) => ({ url: absoluteSiteUrl(`/articles/${slug}/`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...services.map(({ slug }) => ({ url: absoluteSiteUrl(`/services/${slug}/`), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];

  return [...new Map([...staticPages, ...dynamicPages].map((entry) => [entry.url, entry])).values()];
}
