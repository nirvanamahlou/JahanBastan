import { PUBLIC_API_BASE_URL } from "./api/client";

// Per-tab only. Never persist account data or share it between users/requests.
let pending: Promise<Response> | undefined;
let recent: { response: Response; expires: number } | undefined;
let generation = 0;

export function invalidateCustomerSession() {
  generation++;
  pending = undefined;
  recent = undefined;
}

if (typeof window !== "undefined") {
  window.addEventListener("customer-authenticated", invalidateCustomerSession);
  window.addEventListener("customer-logged-out", invalidateCustomerSession);
}

export async function readCustomerSession(): Promise<Response> {
  if (recent && recent.expires > Date.now()) return recent.response.clone();
  if (!pending) {
    const version = generation;
    const request = fetch(`${PUBLIC_API_BASE_URL}/account/me`, {
      credentials: "include", cache: "no-store", signal: AbortSignal.timeout(8000),
    }).then(async response => {
      // Consume the body within the timeout, keeping a reusable response.
      const buffered = new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
      if (version === generation && (response.ok || response.status === 401 || response.status === 403)) {
        recent = { response: buffered, expires: Date.now() + 15_000 };
      }
      return buffered;
    }).finally(() => { if (pending === request) pending = undefined; });
    pending = request;
  }
  return (await pending).clone();
}
