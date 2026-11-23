import type { NextRequest } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const INTERNAL_API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000/api/v1";

async function proxyPassengerRequest(request: NextRequest): Promise<Response> {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "origin", "referer"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  const fetchUpstream = (baseUrl: string) =>
    fetch(`${baseUrl}/account/passengers`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

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

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch {
    return Response.json(
      { detail: "ارتباط با سرویس ذخیرهٔ اطلاعات مسافر برقرار نشد." },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
export const GET = proxyPassengerRequest;
export const POST = proxyPassengerRequest;