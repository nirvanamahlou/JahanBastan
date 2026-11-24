"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, type PointerEvent, useEffect, useRef, useState } from "react";

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
  requiresContact: boolean;
  accessToken?: string;
};

type StoredSession = { id: number; token: string };
type Customer = { id: number; fullName: string; phone?: string | null; buyerMobile?: string | null };
type SupportContact = { fullName: string; phone: string };

type LauncherPosition = { left: number; top: number };
type LauncherDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  origin: LauncherPosition;
  moved: boolean;
};

function clampLauncher(position: LauncherPosition, button: HTMLButtonElement): LauncherPosition {
  const inset = 8;
  return {
    left: Math.max(inset, Math.min(position.left, window.innerWidth - button.offsetWidth - inset)),
    top: Math.max(inset, Math.min(position.top, window.innerHeight - button.offsetHeight - inset)),
  };
}

const STORAGE_KEY = "jahan-bastan-support-chat";
const CONTACT_INPUT = "min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
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

function readStoredSession(customerId: number): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${customerId}`) ?? window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.id === "number" && typeof parsed.token === "string"
      ? { id: parsed.id, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

function forgetStoredSession(customerId: number, conversationId?: number) {
  try {
    window.localStorage.removeItem(`${STORAGE_KEY}:${customerId}`);
    if (conversationId && readStoredSession(customerId)?.id === conversationId) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // This browser does not allow local storage.
  }
}

function normalizePhone(value: string) {
  let phone = value.replace(/[۰-۹٠-٩]/g, character => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(character) % 10)).replace(/[\s()-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  else if (/^0[1-9][0-9]{9}$/.test(phone)) phone = "+98" + phone.slice(1);
  else if (/^9[0-9]{9}$/.test(phone)) phone = "+98" + phone;
  return /^\+[1-9][0-9]{9,14}$/.test(phone) ? phone : null;
}

function profileContact(customer: Customer | null): SupportContact {
  const fullName = customer?.fullName?.trim() ?? "";
  return { fullName: fullName === "کاربر جهان باستان" ? "" : fullName, phone: customer?.phone || customer?.buyerMobile || "" };
}

export function SupportChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const launcherDrag = useRef<LauncherDrag | null>(null);
  const suppressLauncherClick = useRef(false);

  useEffect(() => {
    const clampPosition = () => {
      const button = launcherRef.current;
      if (button) setLauncherPosition((current) => current && clampLauncher(current, button));
    };
    window.addEventListener("resize", clampPosition);
    return () => window.removeEventListener("resize", clampPosition);
  }, []);

  function startLauncherDrag(event: PointerEvent<HTMLButtonElement>) {
    if (open || !event.isPrimary || event.button !== 0) return;
    const { left, top } = event.currentTarget.getBoundingClientRect();
    suppressLauncherClick.current = false;
    launcherDrag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { left, top }, moved: false };
    if (event.pointerType === "mouse") event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLauncher(event: PointerEvent<HTMLButtonElement>) {
    const drag = launcherDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    setLauncherPosition(clampLauncher({ left: drag.origin.left + dx, top: drag.origin.top + dy }, event.currentTarget));
  }

  function finishLauncherDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = launcherDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    suppressLauncherClick.current = drag.moved;
    launcherDrag.current = null;
  }
  const [session, setSession] = useState<StoredSession | null>(null);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>();
  const [contact, setContact] = useState<SupportContact>(profileContact(null));
  const [confirmedContact, setConfirmedContact] = useState<SupportContact | null>(null);
  const customerId = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);
  const sendingRef = useRef(false);

  const requiresContact = !session || conversation?.requiresContact === true;
  const canSend = Boolean(customer && (!requiresContact || confirmedContact) && (!session || conversation));
  const showContact = Boolean(customer && requiresContact && !confirmedContact);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    async function checkAuthentication() {
      const currentRequest = ++requestId;
      const response = await readCustomerSession().catch(() => null);
      const profile = response?.ok
        ? await (response.json() as Promise<{ user: Customer }>).catch(() => null)
        : null;
      if (cancelled || currentRequest !== requestId) return;
      const nextCustomer = typeof profile?.user?.id === "number" ? profile.user : null;
      if (nextCustomer?.id !== customerId.current) {
        customerId.current = nextCustomer?.id;
        setSession(nextCustomer ? readStoredSession(nextCustomer.id) : null);
        setConversation(null);
        setContact(profileContact(nextCustomer));
        setConfirmedContact(null);
        setDraft("");
        setError("");
        setUnread(false);
        messageCountRef.current = 0;
      }
      setCustomer(nextCustomer);
    }
    const handleSessionChange = () => void checkAuthentication();
    void checkAuthentication();
    window.addEventListener("customer-authenticated", handleSessionChange);
    window.addEventListener("customer-logged-out", handleSessionChange);
    return () => {
      cancelled = true;
      window.removeEventListener("customer-authenticated", handleSessionChange);
      window.removeEventListener("customer-logged-out", handleSessionChange);
    };
  }, []);

  useEffect(() => {
    if (!open || (!showContact && !canSend)) return;
    const timer = window.setTimeout(() => (showContact ? contactRef : inputRef).current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [canSend, open, showContact]);

  useEffect(() => {
    if (!customer || !session) return;
    const ownerId = customer.id;
    const { id, token } = session;
    let cancelled = false;

    async function loadConversation(showLoading = false) {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch(
          `${PUBLIC_API_BASE_URL}/support/conversations/${id}?token=${encodeURIComponent(token)}`,
          { cache: "no-store", credentials: "include" },
        );
        if (response.status === 404) {
          if (!cancelled) {
            forgetStoredSession(ownerId, id);
            setSession(null);
            setConversation(null);
            setConfirmedContact(null);
            messageCountRef.current = 0;
          }
          return;
        }
        if (!response.ok) throw new Error("load failed");
        const payload = (await response.json()) as SupportConversation;
        if (!cancelled && payload.messages.length >= messageCountRef.current) {
          if (
            payload.messages.length > messageCountRef.current &&
            payload.lastSender === "admin" &&
            !open
          ) {
            setUnread(true);
          }
          messageCountRef.current = payload.messages.length;
          setConversation(payload);
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
  }, [customer, open, session]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, open]);

  if (pathname.startsWith("/admin")) return null;

  async function sendMessage(message: string, quickReplyKey?: QuickReplyKey) {
    const cleanMessage = message.trim();
    if (cleanMessage.length < 2 || !customer || !canSend || sendingRef.current) return;
    const senderId = customer.id;
    const newContact = requiresContact ? confirmedContact : undefined;
    sendingRef.current = true;
    setSending(true);
    setError("");
    try {
      const response = session
        ? await fetch(
            `${PUBLIC_API_BASE_URL}/support/conversations/${session.id}/messages`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: session.token,
                message: cleanMessage,
                quickReplyKey,
                contact: newContact,
              }),
            },
          )
        : await fetch(`${PUBLIC_API_BASE_URL}/support/conversations`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: cleanMessage,
              quickReplyKey,
              contact: newContact,
              subject: quickReplyKey ? "راهنمای سریع سایت" : "گفتگو با پشتیبانی",
            }),
          });
      if (customerId.current !== senderId) return;
      if (response.status === 409 && conversation?.requiresContact === false) {
        const payload = await response.json().catch(() => null);
        if (payload?.detail === "support_contact_required") {
          setConversation({ ...conversation, requiresContact: true });
          setConfirmedContact(null);
          return;
        }
      }
      if (!response.ok) throw new Error("send failed");
      const payload = (await response.json()) as SupportConversation;
      if (customerId.current !== senderId) return;
      const nextSession = session ?? (payload.accessToken ? { id: payload.id, token: payload.accessToken } : null);
      if (nextSession && (!session || newContact)) {
        forgetStoredSession(senderId, nextSession.id);
        try {
          window.localStorage.setItem(`${STORAGE_KEY}:${senderId}`, JSON.stringify(nextSession));
        } catch {
          // Keep the chat open in memory when browser storage is unavailable.
        }
        if (!session) setSession(nextSession);
      }
      messageCountRef.current = payload.messages.length;
      setConversation(payload);
      setDraft("");
      setConfirmedContact(null);
    } catch {
      if (customerId.current === senderId) setError("پیام ارسال نشد. لطفاً دوباره تلاش کنید.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function confirmContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = contact.fullName.trim();
    const phone = normalizePhone(contact.phone);
    if (!fullName || !phone) {
      setError("نام و نام خانوادگی و شماره تماس معتبر را وارد کنید.");
      return;
    }
    setError("");
    setConfirmedContact({ fullName, phone });
  }

  function resetConversation() {
    if (customer) forgetStoredSession(customer.id, session?.id);
    setSession(null);
    setConversation(null);
    setContact(profileContact(customer ?? null));
    setConfirmedContact(null);
    setDraft("");
    setError("");
    setUnread(false);
    messageCountRef.current = 0;
  }

  const accountPath = pathname.startsWith("/") ? pathname : "/";
  const registrationHref = `/account/?mode=register&next=${encodeURIComponent(accountPath)}`;

  return (
    <div className="support-chat-widget fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(.75rem,env(safe-area-inset-right))] z-[90] sm:bottom-6 sm:right-6" dir="rtl"
      style={!open && launcherPosition ? { ...launcherPosition, right: "auto", bottom: "auto" } : undefined}
    >
      {open ? (
        <section
          aria-labelledby="support-chat-title"
          className={`mb-3 flex w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-brand/20 bg-white text-foreground shadow-[0_24px_70px_rgba(1,37,105,0.28)] ${canSend ? "h-[min(34rem,calc(100dvh-7rem))]" : ""}`}
          role="dialog"
        >
          <header className="flex items-center justify-between gap-3 bg-brand px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/15">
                <ChatIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-black" id="support-chat-title">پشتیبانی جهان باستان</h2>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {customer && session ? (
                <button
                  aria-label="گفت‌وگوی جدید"
                  className="min-h-9 rounded-xl bg-white/10 px-2.5 text-[11px] font-bold transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={resetConversation}
                  disabled={sending}
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

          {showContact ? (
            <form className="space-y-3 overflow-y-auto bg-surface-muted p-4" onSubmit={confirmContact}>
              <p className="text-sm leading-6 text-muted">برای شروع، نام و شماره تماس خود را تأیید کنید.</p>
              <label className="block space-y-1 text-sm font-bold text-brand">
                <span>نام و نام خانوادگی</span>
                <input
                  autoComplete="name"
                  className={CONTACT_INPUT}
                  maxLength={150}
                  name="fullName"
                  onChange={(event) => setContact({ ...contact, fullName: event.target.value })}
                  ref={contactRef}
                  required
                  value={contact.fullName}
                />
              </label>
              <label className="block space-y-1 text-sm font-bold text-brand">
                <span>شماره تماس</span>
                <input
                  autoComplete="tel"
                  className={CONTACT_INPUT}
                  dir="ltr"
                  inputMode="tel"
                  maxLength={32}
                  name="phone"
                  onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                  required
                  type="tel"
                  value={contact.phone}
                />
              </label>
              {error ? <p className="text-xs font-bold text-red-700" role="alert">{error}</p> : null}
              <button className="min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-black text-white hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent" type="submit">
                ادامه به گفتگو
              </button>
            </form>
          ) : canSend ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#f5f8ff] p-3.5" aria-live="polite">
                {!conversation?.messages.length ? (
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

              <form className="border-t border-border bg-white p-3" onSubmit={submit}>
                {error ? <p className="mb-2 text-xs font-bold text-red-700" role="alert">{error}</p> : null}
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
                {confirmedContact ? <button className="mt-2 text-xs font-bold text-brand underline" disabled={sending} onClick={() => setConfirmedContact(null)} type="button">تغییر اطلاعات تماس</button> : null}
              </form>
            </>
          ) : customer === null ? (
            <div className="space-y-3 bg-surface-muted p-4">
              <p className="text-sm leading-6 text-muted">برای شروع گفتگو وارد حساب شوید یا ثبت‌نام کنید.</p>
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#eb5d9f] px-4 text-sm font-black text-white transition hover:bg-[#d94a8c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-200"
                href={registrationHref}
                onClick={() => setOpen(false)}
              >
                ثبت‌نام
              </Link>
            </div>
          ) : (
            <p className="p-4 text-center text-sm text-muted" role="status">{error || (loading ? "در حال بازیابی گفتگو…" : "در حال بررسی حساب کاربری…")}</p>
          )}
        </section>
      ) : null}

      <button
        aria-expanded={open}
        aria-label={open ? "بستن پشتیبانی آنلاین" : "باز کردن پشتیبانی آنلاین"}
        className="support-chat-launcher relative flex size-[44px] touch-none select-none items-center justify-center rounded-xl border-2 border-white bg-[#102747] p-0 leading-none text-white shadow-[0_8px_22px_rgba(16,39,71,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:size-16 sm:rounded-2xl"
        ref={launcherRef}
        onPointerDown={startLauncherDrag}
        onPointerMove={moveLauncher}
        onPointerUp={finishLauncherDrag}
        onPointerCancel={finishLauncherDrag}
        onLostPointerCapture={finishLauncherDrag}
        onClick={(event) => {
          if (event.detail !== 0 && suppressLauncherClick.current) {
            suppressLauncherClick.current = false;
            return;
          }
          setOpen((current) => {
            const next = !current;
            if (next) setUnread(false);
            return next;
          });
        }}
        type="button"
      >
        <ChatIcon className="block size-6 shrink-0 sm:size-8" />
        {customer && unread ? <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-amber-400" aria-label="پاسخ جدید" /> : null}
      </button>
    </div>
  );
}
