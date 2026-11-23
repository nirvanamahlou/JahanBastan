import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AdminUser } from "@/types/admin";

export const ADMIN_API_BASE_URL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const INTERNAL_ADMIN_API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000/api/v1";

/**
 * Requests made by an admin server component run inside the frontend
 * container in Docker. In that context 127.0.0.1 points back to the frontend
 * container, so retry a connection failure through the backend service name.
 * Application responses such as 401 and 500 are deliberately returned as-is
 * so they can be handled or displayed instead of being hidden.
 */
export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const request = (baseUrl: string) => fetch(`${baseUrl}${path}`, init);

  let response: Response | null = null;
  try {
    response = await request(ADMIN_API_BASE_URL);
  } catch {
    // The Docker fallback below gives server-rendered admin pages a usable URL.
  }

  if (response && response.status < 502) return response;
  if (INTERNAL_ADMIN_API_BASE_URL === ADMIN_API_BASE_URL) {
    return response ?? new Response(null, { status: 503 });
  }

  try {
    return await request(INTERNAL_ADMIN_API_BASE_URL);
  } catch {
    return response ?? new Response(null, { status: 503 });
  }
}

export async function requireAdmin(): Promise<{
  user: AdminUser;
  cookieHeader: string;
}> {
  const cookieHeader = (await cookies()).toString();
  const response = await adminFetch("/auth/me", {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) redirect("/admin/login/");
  const payload = (await response.json()) as { user: AdminUser };
  return { user: payload.user, cookieHeader };
}
