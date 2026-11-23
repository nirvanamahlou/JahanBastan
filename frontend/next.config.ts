import type { NextConfig } from "next";

import { getSiteUrl } from "./src/lib/site-url";

const publicSiteUrl = new URL(getSiteUrl());

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true,
  // Native HMAC requests cannot follow redirects or change their signed path.
  // Canonical page redirects are handled explicitly in proxy.ts to avoid self-redirects.
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
  images: {
    // Public media is served by the same-origin Next.js gateway, so mobile
    // browsers never need access to the Docker-only backend hostname or port.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          ...(publicSiteUrl.protocol === "https:"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
