/**
 * Routes browser-side management requests through the frontend origin.
 * The proxy keeps the authenticated cookie on the current host and lets the
 * frontend container use its internal backend URL instead of a build-time URL.
 */
export const ADMIN_PROXY_PREFIX = "/admin-gateway";

export function adminClientFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(init.method ?? "GET")) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }
  return fetch(`${ADMIN_PROXY_PREFIX}${path}`, {
    credentials: "same-origin",
    ...init,
    headers,
  });
}