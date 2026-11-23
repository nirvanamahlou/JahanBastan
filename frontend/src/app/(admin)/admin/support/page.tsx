import { SupportConversationManager, type SupportConversation } from "@/components/admin/support-conversation-manager";
import { adminFetch, requireAdmin } from "@/lib/admin";

export default async function AdminSupportPage() {
  const { cookieHeader } = await requireAdmin();
  const response = await adminFetch("/admin/support/conversations", {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  const conversations = response.ok
    ? ((await response.json()) as SupportConversation[])
    : [];

  return (
    <section className="space-y-6" dir="rtl">
      <header className="rounded-3xl bg-brand p-6 text-white">
        <p className="text-sm text-white/70">ارتباط با مسافران</p>
        <h1 className="mt-2 text-3xl font-black">گفتگوهای پشتیبانی</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
          پیام‌های ارسال‌شده از چت‌بات و پنل کاربری را ببینید، پاسخ دهید و وضعیت هر گفتگو را مدیریت کنید. پاسخ شما مستقیماً در پنجره چت کاربر نمایش داده می‌شود.
        </p>
      </header>
      <SupportConversationManager initial={conversations} />
    </section>
  );
}