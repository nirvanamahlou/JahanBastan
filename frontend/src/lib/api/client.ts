const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
const INTERNAL_API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000/api/v1";

/**
 * Browser requests always stay on the site origin. Production nginx already
 * forwards `/api/v1` to FastAPI, so phones never receive a Docker-only address
 * such as `localhost:8000` (which would point back to the phone itself).
 */
export const PUBLIC_API_BASE_URL = "/backend-gateway";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The upstream timeout signal opts fetch out of Next's render memoization.
// Only anonymous public collections may share work, and only while their JSON
// response is being fetched. Prices and publication changes are read afresh
// after settlement; account, booking, payment, and admin reads never enter here.
const PUBLIC_COLLECTION_PATHS = new Set([
  "/countries", "/destinations", "/tours", "/tours/filter-options",
  "/hotels", "/hotels/countries", "/services", "/articles", "/faqs", "/settings",
]);
const pendingPublicReads = new Map<string, Promise<unknown>>();
const MAX_PENDING_PUBLIC_READS = 128;

function canSharePublicRead(path: string, init: Omit<RequestInit, "method">): boolean {
  return typeof window === "undefined"
    && PUBLIC_COLLECTION_PATHS.has(path.split("?", 1)[0])
    && init.headers === undefined
    && init.signal === undefined
    && Reflect.ownKeys(init).every(key => key === "cache" && init.cache === "no-store");
}

export async function apiGet<T>(
  path: string,
  init: Omit<RequestInit, "method"> = {},
): Promise<T> {
  if (!canSharePublicRead(path, init)) return requestApiGet<T>(path, init);

  const existing = pendingPublicReads.get(path);
  if (existing) return structuredClone(await existing) as T;
  if (pendingPublicReads.size >= MAX_PENDING_PUBLIC_READS) {
    return requestApiGet<T>(path, init);
  }

  const pending = requestApiGet<T>(path, init);
  pendingPublicReads.set(path, pending);
  try {
    // Renderers may decorate API objects. Each caller owns a separate JSON value.
    return structuredClone(await pending);
  } catch (error) {
    // Public pages may show an empty fallback. Record the final producer failure
    // without query strings, credentials, response bodies, or private endpoints.
    console.warn("Public API read failed", {
      path: path.split("?", 1)[0],
      status: error instanceof ApiError ? error.status : 502,
    });
    throw error;
  } finally {
    pendingPublicReads.delete(path);
  }
}

async function requestApiGet<T>(
  path: string,
  init: Omit<RequestInit, "method">,
): Promise<T> {
  const requestInit: RequestInit = {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  };
  let response: Response | undefined;

  for (const baseUrl of [...new Set([API_BASE_URL, INTERNAL_API_BASE_URL])]) {
    // Bound each upstream attempt, including reading the body, so a stalled
    // API cannot leave the public shell waiting indefinitely.
    init.signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(4_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      const candidate = await fetch(`${baseUrl}${path}`, { ...requestInit, signal });
      response = candidate;
      if (candidate.ok) return (await candidate.json()) as T;
      // A valid 4xx response must remain visible to the caller; only a failed
      // upstream connection or gateway response needs the internal fallback.
      if (candidate.status < 502) break;
    } catch {
      init.signal?.throwIfAborted();
      // The internal Docker origin is tried below when the public origin fails.
    }
  }

  if (!response || !response.ok) {
    throw new ApiError(
      "دریافت اطلاعات از سرور ناموفق بود.",
      response?.status ?? 502,
    );
  }

  throw new ApiError("دریافت اطلاعات از سرور ناموفق بود.", 502);
}
