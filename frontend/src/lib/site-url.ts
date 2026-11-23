const PRODUCTION_SITE_URL = "https://jahanbastan.ir";
const DEVELOPMENT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(
  configuredUrl = process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv = process.env.NODE_ENV,
): string {
  const fallback =
    nodeEnv === "development" ? DEVELOPMENT_SITE_URL : PRODUCTION_SITE_URL;
  const candidate = configuredUrl?.trim() || fallback;

  try {
    const url = new URL(candidate);
    if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) {
      return fallback;
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

export const SITE_URL = getSiteUrl();

export function absoluteSiteUrl(path = "/"): string {
  return new URL(path.replace(/^\/+/, ""), `${SITE_URL}/`).toString();
}
