"use client";

import { useRouter } from "next/navigation";

import { adminClientFetch } from "@/lib/admin-client";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await adminClientFetch("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      className="w-full rounded-xl border border-white/25 px-4 py-2 font-bold text-white hover:bg-white/10"
      onClick={logout}
      type="button"
    >
      خروج
    </button>
  );
}
