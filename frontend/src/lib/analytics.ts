export const GA_MEASUREMENT_ID = "G-6GYSK29XHN";

const PUBLIC_SECTIONS = new Set([
  "about", "articles", "compare", "contact", "destinations", "faq", "hotels",
  "installments", "privacy", "services", "terms", "tours", "travel-guide",
]);

export function analyticsPageUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !["jahanbastan.ir", "www.jahanbastan.ir"].includes(url.hostname)) return null;
    const section = url.pathname.split("/")[1];
    if (section && !PUBLIC_SECTIONS.has(section)) return null;
    // Query strings and fragments can contain contact details or access tokens.
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function analyticsReferrer(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    return `${url.origin}/`;
  } catch {
    return "";
  }
}
