"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";

type AuditSource = "cart" | "booking" | "lead";
type LoginStatus = "active" | "expired" | "revoked";

type AuditEvent = {
  id: number;
  source: AuditSource;
  entityType: "cart" | "booking" | "lead";
  entityId: number;
  actorName: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  occurredAt: string;
};

type LoginEvent = {
  id: number;
  adminUserId: number | null;
  actorName: string;
  email: string;
  role: "super_admin" | "admin" | "editor" | "deleted";
  status: LoginStatus;
  loggedInAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
};

const sourceLabels: Record<AuditSource, string> = {
  cart: "سبد خرید",
  booking: "رزرو و پرداخت",
  lead: "پیگیری فروش",
};

const loginStatusLabels: Record<LoginStatus, string> = {
  active: "فعال",
  expired: "منقضی‌شده",
  revoked: "خروج انجام‌شده",
};

const loginStatusClasses: Record<LoginStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  expired: "bg-amber-50 text-amber-700",
  revoked: "bg-surface-muted text-muted",
};

const roleLabels: Record<LoginEvent["role"], string> = {
  super_admin: "مدیر ارشد",
  admin: "مدیر عملیات",
  editor: "ویرایشگر محتوا",
  deleted: "کاربر حذف‌شده",
};

const roleCards = [
  ["مدیر ارشد", "مدیریت کاربران، نقش‌ها، گزارش‌های حساس و سوابق فعالیت."],
  ["مدیر عملیات", "رسیدگی به رزرو، پرداخت، سبد، مشتری و پشتیبانی."],
  ["ویرایشگر محتوا", "مدیریت محتوای سفر؛ بدون دسترسی به اطلاعات مشتری و مالی."],
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminAuditPanel({
  initialEvents,
  initialLogins,
}: {
  initialEvents: AuditEvent[];
  initialLogins: LoginEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [logins, setLogins] = useState(initialLogins);
  const [source, setSource] = useState<"all" | AuditSource>("all");
  const [loginStatus, setLoginStatus] = useState<"all" | LoginStatus>("all");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const visibleEvents = useMemo(
    () => events.filter((event) => source === "all" || event.source === source),
    [events, source],
  );
  const visibleLogins = useMemo(
    () =>
      logins.filter(
        (login) => loginStatus === "all" || login.status === loginStatus,
      ),
    [loginStatus, logins],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [eventsResponse, loginsResponse] = await Promise.all([
        adminClientFetch("/admin/audit/events?pageSize=100", {
          credentials: "include",
        }),
        adminClientFetch("/admin/audit/logins?pageSize=100", {
          credentials: "include",
        }),
      ]);
      const eventsBody = (await eventsResponse.json().catch(() => null)) as {
        detail?: string;
        items?: AuditEvent[];
      } | null;
      const loginsBody = (await loginsResponse.json().catch(() => null)) as {
        detail?: string;
        items?: LoginEvent[];
      } | null;
      if (!eventsResponse.ok) {
        throw new Error(eventsBody?.detail ?? "دریافت سوابق ناموفق بود.");
      }
      if (!loginsResponse.ok) {
        throw new Error(loginsBody?.detail ?? "دریافت سوابق ورود ناموفق بود.");
      }
      setEvents(eventsBody?.items ?? []);
      setLogins(loginsBody?.items ?? []);
      setNotice("سوابق به‌روزرسانی شد.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "دریافت سوابق ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      {notice ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-bold text-brand"
        >
          {notice}
        </p>
      ) : null}

      <section className="rounded-3xl bg-brand p-6 text-white sm:p-8">
        <p className="text-sm text-white/70">دسترسی و نظارت</p>
        <h1 className="mt-2 text-3xl font-black">امنیت و سوابق مدیریتی</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
          سوابق ورود مدیران و عملیات حساس در این بخش نمایش داده می‌شود. برای
          حفظ حریم خصوصی، متن مدارک، اطلاعات بانکی و جزئیات شخصی مسافران در
          این گزارش وجود ندارد.
        </p>
      </section>

      <section aria-labelledby="role-access-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="role-access-title" className="text-xl font-black text-brand">
              سطح دسترسی کارکنان
            </h2>
            <p className="mt-1 text-sm text-muted">
              هر نقش فقط به اطلاعات لازم برای انجام کار خود دسترسی دارد.
            </p>
          </div>
          <Link
            href="/admin/#admin-users"
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-black text-brand"
          >
            مدیریت کاربران
          </Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {roleCards.map(([title, description], index) => (
            <article
              className={`rounded-2xl p-5 ${index === 0 ? "bg-brand text-white" : "bg-surface-muted text-brand"}`}
              key={title}
            >
              <h3 className="font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="rounded-3xl border border-border bg-white p-5 sm:p-6"
        aria-labelledby="login-history-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="login-history-title"
              className="text-xl font-black text-brand"
            >
              سوابق ورود مدیران
            </h2>
            <p className="mt-1 text-sm text-muted">
              زمان ورود، آخرین فعالیت و وضعیت نشست هر حساب مدیریتی.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="login-status">
              وضعیت ورود
            </label>
            <select
              id="login-status"
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold"
              value={loginStatus}
              onChange={(event) =>
                setLoginStatus(event.target.value as "all" | LoginStatus)
              }
            >
              <option value="all">همه ورودها</option>
              {Object.entries(loginStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={() => void refresh()}
              className="min-h-11 rounded-xl bg-accent px-4 text-sm font-black text-brand disabled:opacity-50"
            >
              {loading ? "در حال دریافت…" : "به‌روزرسانی"}
            </button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-right text-sm">
            <caption className="sr-only">فهرست آخرین ورودهای مدیران</caption>
            <thead className="bg-surface-muted text-muted">
              <tr>
                <th className="p-3">زمان ورود</th>
                <th className="p-3">مدیر</th>
                <th className="p-3">سطح دسترسی</th>
                <th className="p-3">آخرین فعالیت</th>
                <th className="p-3">وضعیت نشست</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogins.map((login) => (
                <tr className="border-b border-border" key={login.id}>
                  <td className="whitespace-nowrap p-3 text-muted">
                    {formatDate(login.loggedInAt)}
                  </td>
                  <td className="p-3">
                    <span className="block font-bold text-brand">
                      {login.actorName}
                    </span>
                    <span className="mt-1 block text-xs text-muted" dir="ltr">
                      {login.email}
                    </span>
                  </td>
                  <td className="p-3">{roleLabels[login.role]}</td>
                  <td className="whitespace-nowrap p-3 text-muted">
                    {login.lastSeenAt
                      ? formatDate(login.lastSeenAt)
                      : "همان زمان ورود"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${loginStatusClasses[login.status]}`}
                    >
                      {loginStatusLabels[login.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {!visibleLogins.length ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted">
                    سابقه ورودی برای این فیلتر ثبت نشده است.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="rounded-3xl border border-border bg-white p-5 sm:p-6"
        aria-labelledby="audit-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="audit-title" className="text-xl font-black text-brand">
              آخرین فعالیت‌های حساس
            </h2>
            <p className="mt-1 text-sm text-muted">
              تأیید رزرو و پرداخت، تمدید ظرفیت و پیگیری‌های فروش.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="audit-source">
              نوع فعالیت
            </label>
            <select
              id="audit-source"
              className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold"
              value={source}
              onChange={(event) =>
                setSource(event.target.value as "all" | AuditSource)
              }
            >
              <option value="all">همه فعالیت‌ها</option>
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={() => void refresh()}
              className="min-h-11 rounded-xl bg-accent px-4 text-sm font-black text-brand disabled:opacity-50"
            >
              {loading ? "در حال دریافت…" : "به‌روزرسانی"}
            </button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-right text-sm">
            <caption className="sr-only">فهرست آخرین رویدادهای مدیریتی</caption>
            <thead className="bg-surface-muted text-muted">
              <tr>
                <th className="p-3">زمان</th>
                <th className="p-3">بخش</th>
                <th className="p-3">فعالیت</th>
                <th className="p-3">انجام‌دهنده</th>
                <th className="p-3">شناسه</th>
                <th className="p-3">تغییر وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr
                  className="border-b border-border"
                  key={`${event.source}-${event.id}`}
                >
                  <td className="whitespace-nowrap p-3 text-muted">
                    {formatDate(event.occurredAt)}
                  </td>
                  <td className="p-3 font-bold text-brand">
                    {sourceLabels[event.source]}
                  </td>
                  <td className="p-3">{event.action}</td>
                  <td className="p-3">{event.actorName}</td>
                  <td className="p-3">
                    {event.entityType === "booking"
                      ? "رزرو"
                      : event.entityType === "cart"
                        ? "سبد"
                        : "سرنخ"}{" "}
                    #{event.entityId.toLocaleString("fa-IR")}
                  </td>
                  <td className="p-3 text-muted">
                    {event.fromStatus || event.toStatus
                      ? `${event.fromStatus ?? "—"} ← ${event.toStatus ?? "—"}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {!visibleEvents.length ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    رویدادی برای این فیلتر ثبت نشده است.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
