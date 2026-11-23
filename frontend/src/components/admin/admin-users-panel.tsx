"use client";

import { FormEvent, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";
import type { AdminUser } from "@/types/admin";

interface Props {
  currentUserId: number;
  initialUsers: AdminUser[];
}

async function accountError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  if (response.status === 401) return "نشست شما پایان یافته است؛ دوباره وارد پنل شوید.";
  if (response.status === 403) return "برای مدیریت کاربران باید با حساب مدیر ارشد وارد شوید.";
  if (data?.detail === "email already registered") return "این ایمیل قبلاً ثبت شده است؛ حساب قبلی را در فهرست بررسی کنید.";
  if (data?.detail === "the last active super administrator cannot be removed") return "حذف آخرین مدیر ارشد فعال امکان‌پذیر نیست.";
  if (data?.detail === "you cannot deactivate your own account") return "امکان حذف حسابی که با آن وارد شده‌اید وجود ندارد.";
  if (response.status === 422) {
    const errors = Array.isArray(data?.detail) ? data.detail : [];
    if (errors.some((item: { loc?: string[] }) => item.loc?.includes("password"))) return "رمز عبور باید بین ۱۲ تا ۱۲۸ کاراکتر باشد.";
    if (errors.some((item: { loc?: string[] }) => item.loc?.includes("email"))) return "یک آدرس ایمیل معتبر وارد کنید.";
    if (errors.some((item: { loc?: string[] }) => item.loc?.some((field) => field === "fullName" || field === "full_name"))) return "نام کامل باید بین ۲ تا ۱۲۰ کاراکتر باشد.";
    return "اطلاعات فرم معتبر نیست؛ نام، ایمیل، رمز عبور و نقش را بررسی کنید.";
  }
  return "ثبت تغییرات ناموفق بود؛ لطفاً دوباره تلاش کنید.";
}

export function AdminUsersPanel({ currentUserId, initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await adminClientFetch(`/admin-users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("full_name") ?? "").trim().replace(/\s+/g, " "),
          email: String(form.get("email") ?? "").trim(),
          password: form.get("password"),
          role: form.get("role"),
        }),
      });
      if (!response.ok) {
        setMessage(await accountError(response));
        return;
      }
      const user = (await response.json()) as AdminUser;
      setUsers((current) => [user, ...current]);
      formElement.reset();
      setMessage("حساب ادمین ایجاد شد.");
    } catch {
      setMessage("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function changeAccountStatus(user: AdminUser) {
    if (busy) return;
    if (!window.confirm(`حساب «${user.fullName}» (${user.email}) برای همیشه از دیتابیس حذف شود؟ این عملیات قابل بازیابی نیست. سوابق فعالیت و رزروها حفظ می‌شوند.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await adminClientFetch(
        `/admin-users/${user.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setMessage(await accountError(response));
        return;
      }
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage("حساب برای همیشه حذف شد. سوابق فعالیت و رزروها حفظ شدند.");
    } catch {
      setMessage("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function changePricingAccess(user: AdminUser) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await adminClientFetch(`/admin-users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canManagePricing: !user.canManagePricing }),
      });
      if (!response.ok) { setMessage(await accountError(response)); return; }
      const updated = await response.json() as AdminUser;
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.canManagePricing ? "دسترسی مدیریت نرخ‌ها فعال شد." : "دسترسی مدیریت نرخ‌ها لغو شد.");
    } catch { setMessage("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید."); }
    finally { setBusy(false); }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-black">کاربران ادمین</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="p-3">نام</th>
                <th className="p-3">نقش</th>
                <th className="p-3">وضعیت</th>
                <th className="p-3">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t border-border" key={user.id}>
                  <td className="p-3">
                    <strong>{user.fullName}</strong>
                    <span className="block text-muted">{user.email}</span>
                  </td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">
                    {user.isActive ? "فعال" : "غیرفعال"}
                  </td>
                  <td className="p-3">
                    {(user.role === "admin" || user.role === "editor") ? <button
                      aria-pressed={Boolean(user.canManagePricing)}
                      className="ml-3 rounded-lg border border-brand px-3 py-2 font-bold text-brand disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void changePricingAccess(user)}
                      type="button"
                    >{user.canManagePricing ? "لغو دسترسی نرخ‌ها" : "فعال‌سازی مدیریت نرخ‌ها"}</button> : null}
                    {user.id !== currentUserId ? (
                      <button
                        className="text-red-700"
                        disabled={busy}
                        onClick={() => changeAccountStatus(user)}
                        type="button"
                      >
                        حذف دائمی
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
        onSubmit={createUser}
      >
        <h2 className="text-xl font-black">ایجاد حساب</h2>
        <input
          className="w-full rounded-xl border border-border px-3 py-2"
          name="full_name"
          minLength={2}
          maxLength={120}
          aria-label="نام کامل"
          placeholder="نام کامل"
          required
        />
        <input
          className="w-full rounded-xl border border-border px-3 py-2"
          name="email"
          placeholder="ایمیل"
          type="email"
          aria-label="ایمیل"
          autoComplete="off"
          required
        />
        <input
          className="w-full rounded-xl border border-border px-3 py-2"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          aria-label="رمز عبور"
          name="password"
          placeholder="رمز عبور حداقل ۱۲ کاراکتر"
          type="password"
          required
        />
        <select
          className="w-full rounded-xl border border-border px-3 py-2"
          defaultValue="editor"
          name="role"
          aria-label="نقش کاربر"
        >
          <option value="editor">ویرایشگر</option>
          <option value="admin">مدیر</option>
          <option value="super_admin">مدیر ارشد</option>
        </select>
        <button
          className="w-full rounded-xl bg-[var(--interaction-hover)] px-4 py-3 font-black text-white shadow-[0_10px_24px_rgb(223_79_145_/_28%)] transition hover:bg-[var(--interaction-hover-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--interaction-hover)]"
          type="submit"
          disabled={busy}
        >
          {busy ? "در حال ثبت…" : "ایجاد حساب"}
        </button>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </form>
    </section>
  );
}
