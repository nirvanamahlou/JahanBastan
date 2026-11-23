/** Fixed server-to-server facade; preserve the native HMAC path and raw bytes. */
export const NORA_API_PREFIX = "/api/v1/integration/nora/v1";
const MAX_BYTES = 8 * 1024 * 1024;
const requestHeaders = [
  "accept",
  "authorization",
  "content-type",
  "x-nora-connection",
  "x-nora-subject",
  "x-nora-branch",
  "x-nora-timestamp",
  "x-nora-request",
  "x-nora-signature",
  "idempotency-key",
  "x-nora-version",
] as const;

function permitted(method: string, path: string): boolean {
  if (/^business\/[a-z0-9/-]+$/.test(path))
    return ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (method === "GET")
    return (
      /^(capabilities|dashboard|presence|report)$/.test(path) ||
      /^resources\/[a-z-]+(?:\/[1-9]\d*)?$/.test(path) ||
      /^catalogue\/[a-z-]+\/(?:schema|value\/[1-9]\d*)$/.test(path) ||
      /^workbooks\/(hotels|tour-prices)\/template$/.test(path)
    );
  if (method === "POST")
    return (
      /^(renew|lifecycle|events)$/.test(path) ||
      /^catalogue\/[a-z-]+$/.test(path) ||
      /^workbooks\/(hotels|tour-prices)$/.test(path)
    );
  return method === "PATCH" && /^catalogue\/[a-z-]+\/[1-9]\d*$/.test(path);
}

async function bounded(
  stream: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  if (!stream) return new ArrayBuffer(0);
  const reader = stream.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error("connector deadline");
      const next = await reader.read();
      if (signal.aborted) throw new Error("connector deadline");
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new RangeError("connector size limit");
      }
      chunks.push(next.value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

function failure(status: number, detail: string): Response {
  return Response.json(
    { detail },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function proxyNoraRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const prefix = `${NORA_API_PREFIX}/`;
  const rubiCatalog = request.method === "POST" &&
    ["/api/v1/erp/catalog-delivery", "/api/v1/erp/hotel-profile", "/api/v1/erp/geography-profile"].includes(incoming.pathname) && !incoming.search;
  if (!rubiCatalog && (
    !incoming.pathname.startsWith(prefix) ||
    !permitted(request.method, incoming.pathname.slice(prefix.length))
  ))
    return failure(404, "unsupported connector route");
  // Human admin actions use their separate authenticated, CSRF-protected BFF.
  if (request.headers.has("origin") || request.headers.has("sec-fetch-site"))
    return failure(403, "server-to-server connector requests required");

  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const timeout = setTimeout(abort, request.method === "GET" ? 9000 : 55000);
  let receivingResponse = false;
  try {
    // Only trusted server configuration determines this internal destination.
    const base = new URL(
      process.env.INTERNAL_API_BASE_URL ??
        process.env.API_BASE_URL ??
        "http://backend:8000/api/v1",
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname.replace(/\/$/, "") !== "/api/v1"
    )
      return failure(503, "connector upstream is not configured");
    const target = new URL(incoming.pathname + incoming.search, base.origin);
    const headers = new Headers();
    for (const name of rubiCatalog ? ["content-type", "x-erp-timestamp", "x-erp-signature"] : requestHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const declared = request.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))
      return failure(413, "connector request exceeds size limit");
    if (request.method === "GET" && request.body !== null)
      return failure(400, "connector GET body rejected");
    const content =
      request.method === "GET"
        ? undefined
        : await bounded(request.body, controller.signal);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: content,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return failure(502, "connector upstream redirect rejected");
    }
    if (!upstream.headers.get("content-type")?.includes("application/json")) {
      await upstream.body?.cancel();
      return failure(502, "invalid connector upstream response");
    }
    receivingResponse = true;
    const response = await bounded(upstream.body, controller.signal);
    return new Response(response, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RangeError)
      return failure(
        receivingResponse ? 502 : 413,
        "connector size limit exceeded",
      );
    return failure(
      controller.signal.aborted ? 504 : 502,
      "connector upstream unavailable",
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
  }
}
