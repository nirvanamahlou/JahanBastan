import type { NextRequest } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const INTERNAL_API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000/api/v1";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const responseHeaderNames = [
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
] as const;

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function hasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    // Compare the host rather than the scheme: TLS usually terminates before
    // the Docker container, where Next.js correctly receives the public host
    // but may observe an internal http connection.
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function responseSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (getSetCookie) return getSetCookie.call(headers);
  const legacySetCookie = headers.get("set-cookie");
  return legacySetCookie ? [legacySetCookie] : [];
}

async function proxyPublicRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  if (isUnsafeMethod(request.method) && !hasTrustedOrigin(request)) {
    return Response.json({ detail: "untrusted request origin" }, { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const { path } = await context.params;
  const encodedPath = path.map(encodeURIComponent).join("/");
  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type", "cookie", "origin"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (request.method === "POST" && encodedPath === "account/erp-flight-checkouts") {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  }
  const body = isUnsafeMethod(request.method)
    ? await request.arrayBuffer()
    : undefined;
  const candidates = [...new Set([API_BASE_URL, INTERNAL_API_BASE_URL])];

  const fetchUpstream = (baseUrl: string) => {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/${encodedPath}`);
    url.search = request.nextUrl.search;
    return fetch(url, {
      body,
      cache: "no-store",
      headers,
      method: request.method,
    });
  };

  try {
    let upstream: Response | undefined;
    for (const candidate of candidates) {
      try {
        const result = await fetchUpstream(candidate);
        upstream = result;
        if (result.status < 502) break;
      } catch {
        // Use the Docker-network origin if the configured public origin is down.
      }
    }
    if (!upstream) throw new Error("public API is unavailable");

    const responseHeaders = new Headers();
    for (const name of responseHeaderNames) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of responseSetCookies(upstream.headers)) {
      responseHeaders.append("set-cookie", cookie);
    }
    // Live prices, availability and account/payment responses must not enter
    // the browser HTTP cache, independently of service-worker behaviour.
    if (path[0] !== "media") responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch {
    return Response.json(
      { detail: "ارتباط با سرویس سایت برقرار نشد. دوباره تلاش کنید." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const dynamic = "force-dynamic";
export const GET = proxyPublicRequest;
export const POST = proxyPublicRequest;
export const PATCH = proxyPublicRequest;
export const PUT = proxyPublicRequest;
export const DELETE = proxyPublicRequest;
export const HEAD = proxyPublicRequest;
