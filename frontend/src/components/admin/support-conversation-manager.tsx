"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";

type SupportMessage = {
  id: number;
  senderType: "customer" | "bot" | "admin";
  body: string;
  createdAt: string;
};

export type SupportConversation = {
  id: number;
  subject: string;
  status: "open" | "in_progress" | "closed";
  source: "account" | "chatbot";
  visitorName: string | null;
  visitorEmail: string | null;
  customerName: string | null;
  customerEmail: string | null;
  lastSender: "customer" | "bot" | "admin";
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
};

type FilterStatus = "all" | SupportConversation["status"];

const statusLabels: Record<SupportConversation["status"], string> = {
  open: "باز",
  in_progress: "در حال بررسی",
  closed: "بسته",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function conversationIdentity(item: SupportConversation) {
  return {
    name: item.customerName || item.visitorName || "مهمان سایت",
    email: item.customerEmail || item.visitorEmail || null,
  };
}

export function SupportConversationManager({
  initial,
}: {
  initial: SupportConversation[];
}) {
  const [conversations, setConversations] = useState(initial);
  const [selectedId, setSelectedId] = useState<number | null>(initial[0]?.id ?? null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => conversations.filter((item) => filter === "all" || item.status === filter),
    [conversations, filter],
  );
  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  async function refresh() {
    try {
      const response = await adminClientFetch("/admin/support/conversations", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as SupportConversation[];
      setConversations(payload);
      setSelectedId((current) =>
        current && payload.some((item) => item.id === current)
          ? current
          : payload[0]?.id ?? null,
      );
      setError("");
    } catch {
      setError("دریافت گفتگوهای پشتیبانی ناموفق بود.");
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || reply.trim().length < 1 || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await adminClientFetch(
        `/admin/support/conversations/${selected.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: reply.trim() }),
        },
      );
      if (!response.ok) throw new Error("send failed");
      const updated = (await response.json()) as SupportConversation;
      setConversations((items) =>
        items
          .map((item) => (item.id === updated.id ? updated : item))
          .sort(
            (left, right) =>
              new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
          ),
      );
      setReply("");
    } catch {
      setError("ارسال پاسخ ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: SupportConversation["status"]) {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await adminClientFetch(
        `/admin/support/conversations/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error("status failed");
      const updated = (await response.json()) as SupportConversation;
      setConversations((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("تغییر وضعیت گفتگو ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteConversation() {
    if (!selected || saving) return;
    const identity = conversationIdentity(selected);
    const confirmed = window.confirm(
      `گفتگوی «${identity.name}» و تمام پیام‌های آن برای همیشه حذف شود؟ این عملیات قابل بازگشت نیست.`,
    );
    if (!confirmed) return;

    const conversationId = selected.id;
    setSaving(true);
    setError("");
    try {
      const response = await adminClientFetch(
        `/admin/support/conversations/${conversationId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete failed");

      const remaining = conversations.filter((item) => item.id !== conversationId);
      const visibleRemaining = remaining.filter(
        (item) => filter === "all" || item.status === filter,
      );
      setConversations(remaining);
      setSelectedId(visibleRemaining[0]?.id ?? remaining[0]?.id ?? null);
      setReply("");
    } catch {
      setError("حذف گفتگو ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-[38rem] overflow-hidden rounded-3xl border border-border bg-white shadow-sm lg:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="border-b border-border bg-surface-muted/60 lg:border-b-0 lg:border-l">
        <div className="border-b border-border p-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              ["all", "همه"],
              ["open", "باز"],
              ["in_progress", "در حال بررسی"],
              ["closed", "بسته"],
            ] as const).map(([value, label]) => (
              <button
                className={`min-h-10 rounded-xl px-2 text-xs font-black transition ${
                  filter === value
                    ? "bg-brand text-white"
                    : "border border-border bg-white text-brand hover:bg-accent/20"
                }`}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[34rem] overflow-y-auto p-2">
          {filtered.length ? (
            <ul className="space-y-2">
              {filtered.map((item) => {
                const identity = conversationIdentity(item);
                const lastMessage = item.messages.at(-1);
                return (
                  <li key={item.id}>
                    <button
                      className={`w-full rounded-2xl border p-3 text-right transition ${
                        selectedId === item.id
                          ? "border-brand bg-brand text-white shadow-md"
                          : "border-border bg-white text-brand hover:border-brand/30"
                      }`}
                      onClick={() => setSelectedId(item.id)}
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <strong className="truncate text-sm">{identity.name}</strong>
                        {item.lastSender === "customer" ? (
                          <span className="mt-1 size-2.5 shrink-0 rounded-full bg-[#eb5d9f]" title="پیام جدید کاربر" />
                        ) : null}
                      </span>
                      <span className={`mt-1 block truncate text-xs ${selectedId === item.id ? "text-white/70" : "text-muted"}`}>{item.subject}</span>
                      <span className={`mt-2 block truncate text-xs ${selectedId === item.id ? "text-white/80" : "text-muted"}`}>{lastMessage?.body ?? "بدون پیام"}</span>
                      <span className={`mt-2 flex justify-between text-[10px] ${selectedId === item.id ? "text-white/65" : "text-muted"}`}>
                        <span>{statusLabels[item.status]}</span>
                        <span>{formatDate(item.updatedAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted">گفتگویی در این وضعیت وجود ندارد.</p>
          )}
        </div>
      </aside>

      {selected ? (
        <section className="flex min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div>
              <h2 className="font-black text-brand">{conversationIdentity(selected).name}</h2>
              <p className="mt-1 text-xs text-muted" dir="ltr">{conversationIdentity(selected).email || (selected.source === "chatbot" ? "Guest chat" : "Customer account")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-9 rounded-xl border border-emerald-200 px-3 text-xs font-bold text-emerald-700 disabled:opacity-50"
                disabled={saving || selected.status === "in_progress"}
                onClick={() => void changeStatus("in_progress")}
                type="button"
              >
                در حال بررسی
              </button>
              <button
                className="min-h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
                disabled={saving || selected.status === "closed"}
                onClick={() => void changeStatus("closed")}
                type="button"
              >
                بستن گفتگو
              </button>
              {selected.status === "closed" ? (
                <button
                  className="min-h-9 rounded-xl bg-brand px-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void changeStatus("open")}
                  type="button"
                >
                  بازکردن مجدد
                </button>
              ) : null}
              <button
                className="min-h-9 rounded-xl border border-red-300 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                disabled={saving}
                onClick={() => void deleteConversation()}
                type="button"
              >
                حذف دائمی گفتگو
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f6f8fc] p-4 sm:p-6" aria-live="polite">
            {selected.messages.map((message) => {
              const fromSupport = message.senderType !== "customer";
              return (
                <article
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                    fromSupport
                      ? "mr-auto rounded-tl-md bg-brand text-white"
                      : "ml-auto rounded-tr-md border border-border bg-white text-foreground"
                  }`}
                  key={message.id}
                >
                  <strong className={`mb-1 block text-[11px] ${fromSupport ? "text-white/70" : "text-brand"}`}>
                    {message.senderType === "admin"
                      ? "پشتیبان"
                      : message.senderType === "bot"
                        ? "پاسخ خودکار"
                        : "کاربر"}
                  </strong>
                  <p className="whitespace-pre-line">{message.body}</p>
                  <time className={`mt-1 block text-[10px] ${fromSupport ? "text-white/60" : "text-muted"}`}>{formatDate(message.createdAt)}</time>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form className="border-t border-border bg-white p-4" onSubmit={sendReply}>
            {error ? <p className="mb-2 text-xs font-bold text-red-600">{error}</p> : null}
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-20 min-w-0 flex-1 resize-y rounded-2xl border border-border p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                maxLength={4000}
                onChange={(event) => setReply(event.target.value)}
                placeholder="پاسخ پشتیبان را بنویسید…"
                value={reply}
              />
              <button
                className="min-h-12 rounded-2xl bg-[#eb5d9f] px-5 text-sm font-black text-white disabled:opacity-50"
                disabled={saving || reply.trim().length < 1}
                type="submit"
              >
                {saving ? "در حال ارسال…" : "ارسال پاسخ"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="grid place-items-center p-8 text-center text-muted">برای شروع یک گفتگو را انتخاب کنید.</div>
      )}
    </div>
  );
}