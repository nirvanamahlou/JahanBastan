/** Only return to local app pages; never navigate to an external or login URL. */
export function appReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || /[\\\x00-\x20]/.test(value)) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\x00-\x20]/.test(decoded)) return "/";
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || /^\/login(?:\/|$)/.test(url.pathname)) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}

export function isAppEntryExempt(path: string): boolean {
  return /^\/account\/(forgot-password|reset-password)\/?$/.test(path)
    || /^\/(privacy|terms)\/?$/.test(path);
}
