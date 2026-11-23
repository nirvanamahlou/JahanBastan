import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;
  if (request.headers.get("origin") !== configuredOrigin || Number(request.headers.get("content-length") ?? 0) > 256) return new Response(null, {status: 403});
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, {status: 400});
  let body = "";
  try {
    for (;;) {const chunk = await reader.read(); if (chunk.done) break; body += new TextDecoder().decode(chunk.value); if (body.length > 256) {await reader.cancel(); return new Response(null, {status: 413});}}
    const payload = JSON.parse(body);
    if (Object.keys(payload).sort().join(",") !== "browserId,category,eventId" || !/^[a-f0-9]{32}$/.test(payload.browserId) || !/^[a-f0-9]{32}$/.test(payload.eventId) || !["home","destinations","tours","hotels","flights","trains","buses","visas","services","articles","other"].includes(payload.category)) return new Response(null, {status: 400});
    const base = process.env.INTERNAL_API_BASE_URL ?? process.env.API_BASE_URL;
    if (!base) return new Response(null, {status: 503});
    const upstream = await fetch(`${base}/activity/nora-presence`, {method: "POST", headers: {"Content-Type": "application/json", "Origin": request.headers.get("origin")!}, body: JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store"});
    return new Response(null, {status: upstream.ok ? 204 : 503, headers: {"Cache-Control": "no-store"}});
  } catch {return new Response(null, {status: 503});}
}
