import type { MetadataRoute } from "next";

import { absoluteSiteUrl, SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin/",
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
