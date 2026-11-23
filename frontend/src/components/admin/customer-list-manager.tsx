"use client";

import { useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";

export type Customer = {
  id: number;
  email: string;
  fullName: string;
  accountType: "customer" | "agency";
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CustomerListManager({ initial, initialTotal }: { initial: Customer[]; initialTotal: number }) {
  const [customers, setCustomers] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function hideCustomer(customer: Customer) {
    if (!window.confirm(`حساب «${customer.fullName}» فقط از فهرست مشتریان مدیریت پنهان شود؟ اطلاعات فروش و پشتیبانی حذف نمی‌شود.`)) return;
    setBusyId(customer.id);
    setMessage("");
    try {
      const response = await adminClientFetch(`/admin/customers/${customer.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setTotal((current) => Math.max(0, current - 1));
      setMessage("حساب مشتری از فهرست مدیریت حذف شد.");
    } catch {
      setMessage("حذف از فهرست مشتریان ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-black text-brand">فهرست کاربران</h2>
          <p className="mt-1 text-xs text-muted">حذف از این فهرست، حساب و سوابق تجاری مشتری را پاک نمی‌کند.</p>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">{total.toLocaleString("fa-IR")} کاربر</span>
      </div>
      {message ? <p aria-live="polite" className="border-b border-border bg-surface-muted px-5 py-3 text-sm font-bold text-brand">{message}</p> : null}
      {customers.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[52rem] w-full text-right text-sm"><caption className="sr-only">فهرست مشتریان</caption>
            <thead className="bg-surface-muted text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-bold">نام</th>
                <th className="px-5 py-3 font-bold">نوع حساب</th>
                <th className="px-5 py-3 font-bold">ایمیل</th>
                <th className="px-5 py-3 font-bold">موبایل</th>
                <th className="px-5 py-3 font-bold">زمان ثبت‌نام</th>
                <th className="px-5 py-3 font-bold">آخرین ورود</th>
                <th className="px-5 py-3 font-bold">وضعیت</th>
                <th className="px-5 py-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr className="border-t border-border" key={customer.id}>
                  <td className="px-5 py-4 font-bold text-brand">{customer.fullName}</td>
                  <td className="px-5 py-4">{customer.accountType === "agency" ? "آژانس" : "مسافر"}</td>
                  <td className="px-5 py-4" dir="ltr">{customer.email}</td>
                  <td className="px-5 py-4" dir="ltr">{customer.phone ?? "—"}</td>
                  <td className="px-5 py-4 text-muted">{formatDate(customer.createdAt)}</td>
                  <td className="px-5 py-4 text-muted">{formatDate(customer.lastLoginAt)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${customer.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{customer.isActive ? "فعال" : "غیرفعال"}</span></td>
                  <td className="px-5 py-4"><button className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-black text-red-700 disabled:opacity-50" disabled={busyId === customer.id} onClick={() => void hideCustomer(customer)} type="button">حذف از فهرست</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-12 text-center text-sm text-muted">کاربری برای نمایش وجود ندارد.</p>}
    </section>
  );
}
