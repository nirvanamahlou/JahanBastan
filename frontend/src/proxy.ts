import { NextRequest, NextResponse } from "next/server";
import { NORA_API_PREFIX, proxyNoraRequest } from "./lib/nora-api-proxy";

export function proxy(request: NextRequest) {
  // Respond before App Router reserializes signed query parameters (e.g. %20).
  if (request.nextUrl.pathname.startsWith(`${NORA_API_PREFIX}/`)) {
    return proxyNoraRequest(request);
  }
  const pathname = request.nextUrl.pathname;
  if (request.nextUrl.hostname === "www.jahanbastan.ir" && ["GET", "HEAD"].includes(request.method)) {
    const url = new URL(request.url);
    url.hostname = "jahanbastan.ir";
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  const isGateway = ["/admin-gateway", "/backend-gateway", "/api", "/.well-known"].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isGateway && pathname !== "/") {
    const isFile = /\.[^/]+\/?$/.test(pathname);
    const canonical = isFile ? pathname.replace(/\/$/, "") : pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (canonical !== pathname) {
      const url = new URL(request.url);
      url.pathname = canonical;
      return NextResponse.redirect(url, 308);
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://ua.yektanet.com https://event.yektanet.com https://audience.yektanet.com https://biscotti.yektanet.com https://cdn.yektanet.com",
    "img-src 'self' data: blob: https://avinaofficial.ir https://www.adalyahotels.com https://trustseal.enamad.ir https://ua.yektanet.com https://biscotti.yektanet.com https://cdn.yektanet.com",
    "font-src 'self' data:",
    "frame-src https://www.google.com https://maps.google.com https://cdn.yektanet.com",
    ...(request.nextUrl.protocol === "https:"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/api/v1/integration/nora/v1/:path*",
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
