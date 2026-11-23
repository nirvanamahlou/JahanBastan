"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { readCustomerSession } from "@/lib/customer-session";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type SenderType = "customer" | "bot" | "admin";
type QuickReplyKey =
  | "tour_booking"
  | "booking_status"
  | "visa_services"
  | "talk_to_support";

type SupportMessage = {
  id: number;
  senderType: SenderType;
  body: string;
  createdAt: string;
};

type SupportConversation = {
  id: number;
  subject: string;
  status: "open" | "in_progress" | "closed";
  lastSender: SenderType;
  messages: SupportMessage[];
  accessToken?: string;
};

type StoredSession = { id: number; token: string };
type AuthenticationState = "checking" | "authenticated" | "guest";

const STORAGE_KEY = "jahan-bastan-support-chat";
const quickReplies: Array<{
  key: QuickReplyKey;
  label: string;
}> = [
  { key: "tour_booking", label: "رزرو تور چگونه انجام می‌شود؟" },
  { key: "booking_status", label: "پیگیری وضعیت رزرو" },
  { key: "visa_services", label: "مدارک و خدمات ویزا" },
  { key: "talk_to_support", label: "گفتگو با پشتیبان" },
];

function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 18.5 3.5 21v-5A8.5 8.5 0 1 1 7 18.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 10.5h8M8 14h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.id === "number" && typeof parsed.token === "string"
      ? { id: parsed.id, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function SupportChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(false);
  const [authenticationState, setAuthenticationState] =
    useState<AuthenticationState>("checking");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSession(readStoredSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkAuthentication() {
      const response = await readCustomerSession().catch(() => null);
      if (!cancelled) {
        setAuthenticationState(response?.ok ? "authenticated" : "guest");
      }
    }
    const handleAuthenticated = () => void checkAuthentication();
    void checkAuthentication();
    window.addEventListener("customer-authenticated", handleAuthenticated);
    return () => {
      cancelled = true;
      window.removeEventListener("customer-authenticated", handleAuthenticated);
    };
  }, []);

  useEffect(() => {
    if (!open || authenticationState !== "authenticated") return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [authenticationState, open]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function loadConversation(showLoading = false) {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch(
          `${PUBLIC_API_BASE_URL}/support/conversations/${session?.id}?token=${encodeURIComponent(session?.token ?? "")}`,
          { cache: "no-store" },
        );
        if (response.status === 404) {
          window.localStorage.removeItem(STORAGE_KEY);
          if (!cancelled) {
            setSession(null);
            setConversation(null);
          }
          return;
        }
        if (!response.ok) throw new Error("load failed");
        const payload = (await response.json()) as SupportConversation;
        if (!cancelled) {
          if (
            payload.messages.length > messageCountRef.current &&
            payload.lastSender === "admin" &&
            !open
          ) {
            setUnread(true);
          }
          messageCountRef.current = payload.messages.length;
          setConversation(payload);
          setError("");
        }
      } catch {
        if (!cancelled && showLoading) {
          setError("ارتباط با پشتیبانی برقرار نشد. دوباره تلاش کنید.");
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    }

    void loadConversation(true);
    const timer = window.setInterval(
      () => void loadConversation(false),
      open ? 5000 : 10000,
    );
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, session]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, open]);

  if (pathname.startsWith("/admin")) return null;

  async function sendMessage(message: string, quickReplyKey?: QuickReplyKey) {
    const cleanMessage = message.trim();
    if (!cleanMessage || sending || authenticationState !== "authenticated") return;
    setSending(true);
    setError("");
    try {
      const response = session
        ? await fetch(
            `${PUBLIC_API_BASE_URL}/support/conversations/${session.id}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: session.token,
                message: cleanMessage,
                quickReplyKey,
              }),
            },
          )
        : await fetch(`${PUBLIC_API_BASE_URL}/support/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: cleanMessage,
              quickReplyKey,
              subject: quickReplyKey ? "راهنمای سریع سایت" : "گفتگو با پشتیبانی",
            }),
          });
      if (!response.ok) throw new Error("send failed");
      const payload = (await response.json()) as SupportConversation;
      if (!session && payload.accessToken) {
        const nextSession = { id: payload.id, token: payload.accessToken };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      }
      messageCountRef.current = payload.messages.length;
      setConversation(payload);
      setDraft("");
    } catch {
      setError("پیام ارسال نشد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }
  function resetConversation() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setConversation(null);
    setDraft("");
    setError("");
    setUnread(false);
    messageCountRef.current = 0;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const accountPath = pathname.startsWith("/") ? pathname : "/";
  const registrationHref = `/account/?mode=register&next=${encodeURIComponent(accountPath)}`;

  return (
    <div className="support-chat-widget fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(.75rem,env(safe-area-inset-right))] z-[90] sm:bottom-6 sm:right-6" dir="rtl">
      {open ? (
        <section
          aria-labelledby="support-chat-title"
          className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-brand/20 bg-white text-foreground shadow-[0_24px_70px_rgba(1,37,105,0.28)]"
          role="dialog"
        >
          <header className="flex items-center justify-between gap-3 bg-brand px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/15">
                <ChatIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-black" id="support-chat-title">پشتیبانی جهان باستان</h2>
                <p className="mt-0.5 text-[11px] text-white/75">پاسخ خودکار و ارتباط با پشتیبان</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {session ? (
                <button
                  aria-label="گفت‌وگوی جدید"
                  className="min-h-9 rounded-xl bg-white/10 px-2.5 text-[11px] font-bold transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={resetConversation}
                  type="button"
                >
                  گفت‌وگوی جدید
                </button>
              ) : null}
              <button
              aria-label="بستن پنجره پشتیبانی"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-xl transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f5f8ff] p-3.5" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-tr-md border border-brand/10 bg-white px-3.5 py-3 text-sm leading-6 shadow-sm">
              <strong className="block text-brand">خوش آمدید 👋</strong>
              <span>
                {authenticationState === "authenticated"
                  ? "چه کاری از من برمی‌آید؟ یکی از گزینه‌ها را انتخاب کنید یا سوالتان را بنویسید."
                  : "برای ارسال پیام و پیگیری پاسخ، ابتدا وارد حساب شوید یا ثبت‌نام کنید."}
              </span>
            </div>

            {authenticationState === "guest" && !conversation?.messages.length ? (
              <div className="rounded-2xl border border-brand/15 bg-white p-4 text-center shadow-sm">
                <strong className="block text-sm text-brand">برای ارسال پیام، ابتدا حساب بسازید</strong>
                <p className="mt-1 text-xs leading-6 text-muted">ثبت‌نام سریع است و پاسخ پشتیبانی داخل پنل شما قابل پیگیری می‌ماند.</p>
                <Link
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#eb5d9f] px-4 text-sm font-black text-white transition hover:bg-[#d94a8c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200"
                  href={registrationHref}
                  onClick={() => setOpen(false)}
                >
                  ثبت‌نام در سایت و ارسال پیام
                </Link>
                <p className="mt-2 text-[11px] text-muted">اگر حساب دارید، در همان صفحه گزینه «ورود» را بزنید.</p>
              </div>
            ) : null}

            {authenticationState === "checking" && !conversation?.messages.length ? (
              <p className="rounded-2xl border border-brand/10 bg-white px-4 py-3 text-center text-xs text-muted">در حال بررسی حساب کاربری…</p>
            ) : null}

            {authenticationState === "authenticated" && !conversation?.messages.length ? (
              <div className="grid gap-2">
                {quickReplies.map((item) => (
                  <button
                    className="min-h-10 rounded-xl border border-brand/15 bg-white px-3 text-right text-xs font-bold text-brand transition hover:border-brand/35 hover:bg-accent/25 disabled:opacity-60"
                    disabled={sending}
                    key={item.key}
                    onClick={() => void sendMessage(item.label, item.key)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}

            {loading && !conversation ? <p className="text-center text-xs text-muted">در حال بازیابی گفتگو…</p> : null}
            {conversation?.messages.map((message) => {
              const isCustomer = message.senderType === "customer";
              return (
                <article
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                    isCustomer
                      ? "mr-auto rounded-tl-md bg-brand text-white"
                      : message.senderType === "admin"
                        ? "ml-auto rounded-tr-md border border-pink-200 bg-pink-50 text-brand"
                        : "ml-auto rounded-tr-md border border-brand/10 bg-white"
                  }`}
                  key={message.id}
                >
                  {!isCustomer ? (
                    <strong className="mb-1 block text-[11px] text-brand">
                      {message.senderType === "admin" ? "پشتیبان" : "راهنمای خودکار"}
                    </strong>
                  ) : null}
                  <p className="whitespace-pre-line">{message.body}</p>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {authenticationState === "authenticated" ? <form className="border-t border-border bg-white p-3" onSubmit={submit}>
            {error ? <p className="mb-2 text-xs font-bold text-red-600">{error}</p> : null}
            <div className="flex items-center gap-2">
              <input
                aria-label="پیام شما برای پشتیبانی"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="سوالتان را بنویسید…"
                ref={inputRef}
                value={draft}
              />
              <button
                aria-label="ارسال پیام"
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eb5d9f] text-white shadow-md transition hover:bg-[#d94a8c] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={sending || draft.trim().length < 2}
                type="submit"
              >
                {sending ? "…" : "←"}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted">پاسخ پشتیبان به‌صورت خودکار در همین گفتگو نمایش داده می‌شود.</p>
          </form> : (
            <div className="border-t border-border bg-white p-3">
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#eb5d9f] px-4 text-sm font-black text-white transition hover:bg-[#d94a8c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200"
                href={registrationHref}
                onClick={() => setOpen(false)}
              >
                {authenticationState === "checking" ? "در حال بررسی حساب…" : "ثبت‌نام و شروع گفتگو"}
              </Link>
            </div>
          )}
        </section>
      ) : null}

      <button
        aria-expanded={open}
        aria-label={open ? "بستن پشتیبانی آنلاین" : "باز کردن پشتیبانی آنلاین"}
        className="relative flex size-14 items-center justify-center rounded-2xl border-2 border-white bg-[#eb5d9f] p-0 leading-none text-white shadow-[0_12px_30px_rgba(235,93,159,0.42)] transition hover:-translate-y-0.5 hover:bg-[#d94a8c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200 sm:size-16"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) setUnread(false);
            return next;
          });
        }}
        type="button"
      >
        <ChatIcon className="block size-7 shrink-0 sm:size-8" />
        {unread ? <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-amber-400" aria-label="پاسخ جدید" /> : null}
      </button>
    </div>
  );
}
