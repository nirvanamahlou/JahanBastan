import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const INTERNAL_API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000/api/v1";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyAdminRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  const upstreamPath =
    path[0] === "admin" || path[0] === "admin-users" || path[0] === "auth"
      ? path
      : ["admin", ...path];
  const encodedPath = upstreamPath.map(encodeURIComponent).join("/");

  const headers = new Headers();
  if (upstreamPath[0] === "admin" && upstreamPath[1] === "nora" && !["GET", "HEAD"].includes(request.method)) {
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;
    if (request.headers.get("origin") !== configuredOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
      return Response.json({detail: "untrusted request origin"}, {status: 403});
    }
    headers.set("origin", request.headers.get("origin")!);
    headers.set("x-requested-with", "XMLHttpRequest");
  }
  for (const name of ["accept", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const fetchUpstream = async (baseUrl: string) => {
    const upstreamUrl = new URL(`${baseUrl}/${encodedPath}`);
    upstreamUrl.search = request.nextUrl.search;
    return fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
  };

  try {
    let upstream: Response;
    try {
      upstream = await fetchUpstream(API_BASE_URL);
    } catch {
      if (INTERNAL_API_BASE_URL === API_BASE_URL) throw new Error();
      upstream = await fetchUpstream(INTERNAL_API_BASE_URL);
    }
    if (upstream.status >= 502 && INTERNAL_API_BASE_URL !== API_BASE_URL) {
      upstream = await fetchUpstream(INTERNAL_API_BASE_URL);
    }

    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const isSuccessfulAdminMutation =
      upstream.ok && isMutation && upstreamPath[0] === "admin";

    if (isSuccessfulAdminMutation) {
      // Editorial content can appear on the homepage and in several linked
      // catalogue pages, so invalidate the public tree after every saved edit.
      revalidatePath("/", "layout");
    }
    const responseHeaders = new Headers();
    for (const name of [
      "content-type",
      "content-disposition",
      "cache-control",
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) responseHeaders.set("set-cookie", setCookie);
    return new Response(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch {
    return Response.json(
      { detail: "The management API is unavailable." },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
export const GET = proxyAdminRequest;
export const POST = proxyAdminRequest;
export const PATCH = proxyAdminRequest;
export const PUT = proxyAdminRequest;
export const DELETE = proxyAdminRequest;
