import Link from "next/link";

import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { Badge } from "@/components/ui/badge";
import { ADMIN_API_BASE_URL, requireAdmin } from "@/lib/admin";
import type { AdminUser } from "@/types/admin";

interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
}

const quickActions = [
  { label: "مقصد جدید", href: "/admin/destinations/" },
  { label: "مقاله جدید", href: "/admin/articles/" },
  { label: "سوال جدید", href: "/admin/faq/" },
  { label: "تنظیمات سایت", href: "/admin/settings/" },
] as const;

export default async function AdminPage() {
  const { user, cookieHeader } = await requireAdmin();
  const [destinationsResponse, articlesResponse, faqsResponse] = await Promise.all([
    fetch(`${ADMIN_API_BASE_URL}/admin/destinations`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${ADMIN_API_BASE_URL}/admin/articles`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${ADMIN_API_BASE_URL}/admin/faqs`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
  ]);
  const destinations = destinationsResponse.ok ? (await destinationsResponse.json()) as unknown[] : [];
  const articles = articlesResponse.ok ? (await articlesResponse.json()) as unknown[] : [];
  const faqs = faqsResponse.ok ? (await faqsResponse.json()) as unknown[] : [];
  let initialUsers: AdminUser[] = [];
  if (user.role === "super_admin") {
    const usersResponse = await fetch(`${ADMIN_API_BASE_URL}/admin-users`, { headers: { cookie: cookieHeader }, cache: "no-store" });
    if (usersResponse.ok) initialUsers = ((await usersResponse.json()) as AdminUserListResponse).items;
  }

  const stats = [
    { label: "مقصد", value: destinations.length, href: "/admin/destinations/" },
    { label: "مقاله", value: articles.length, href: "/admin/articles/" },
    { label: "سوال متداول", value: faqs.length, href: "/admin/faq/" },
    { label: "کاربر ادمین", value: initialUsers.length, href: "#admin-users" },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-brand p-6 text-white sm:p-8">
        <Badge variant="accent">داشبورد مدیریت</Badge>
        <h1 className="mt-4 text-3xl font-black">خوش آمدید، {user.fullName}</h1>
        <p className="mt-2 text-white/70">{user.email} · {user.role}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {quickActions.map((action) => <Link key={action.href} href={action.href} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-accent hover:text-brand">{action.label}</Link>)}
        </div>
      </section>
      <section aria-labelledby="content-summary-title">
        <h2 id="content-summary-title" className="text-2xl font-black">خلاصه محتوا</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => <Link key={stat.label} href={stat.href} className="rounded-2xl border border-border bg-surface p-5 shadow-sm"><strong className="text-3xl font-black text-brand">{stat.value.toLocaleString("fa-IR")}</strong><span className="mt-2 block text-sm text-muted">{stat.label}</span></Link>)}
        </div>
      </section>
      {user.role === "super_admin" ? <section id="admin-users"><AdminUsersPanel currentUserId={user.id} initialUsers={initialUsers} /></section> : null}
    </div>
  );
}
