"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
function formatPaymentAmount(value: string | number, currency: string) {
  const label = currency === "IRT" ? "تومان" : currency === "IRR" ? "ریال" : currency;
  return Number(value).toLocaleString("fa-IR", { maximumFractionDigits: 8 }) + " " + label;
}

type Props = { kind: "booking" | "flight"; id: string };
type Booking = {
  bookingNumber: string; status: string; totalAmount: string | null; payableNowAmount?: string | null;
  currency: string; paymentMethod: string; paymentExpiresAt?: string | null;
  items: { titleSnapshot: string }[]; tickets?: { id: number; ticketNumber: string }[];
};
type Flight = { state: string; routeLabel?: string; contractNumber?: string };
type FlightDetails = { totals: { currency: string; amount: string }[] };
type View = { title: string; reference: string; referenceLabel: string; amount: string; next: string; payable?: number; booking?: Booking };
const labels: Record<string, string> = {
  pending_review: "درخواست ثبت شده و در انتظار بررسی قیمت و ظرفیت است. پس از تأیید، وضعیت پرداخت را همین‌جا ببینید.",
  rejected: "درخواست تأیید نشد.", cancelled: "سفارش لغو شده است.", expired: "مهلت پرداخت این سفارش پایان یافته است.",
  paid: "پرداخت این سفارش ثبت شده است.",
};

async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(PUBLIC_API_BASE_URL + path, { credentials: "include", cache: "no-store", signal });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export async function loadOrder({kind, id}: Props, signal: AbortSignal): Promise<View> {
  if (kind === "flight") {
    const path = "/account/erp-flight-checkouts/" + encodeURIComponent(id);
    const flight = await read<Flight>(path, signal);
    const details = await read<FlightDetails>(path + "/details", signal).catch(() => null);
    let next = flight.state === "cancelled" ? labels.cancelled : flight.state === "failed" ? "ثبت درخواست پرواز انجام نشد." : "درخواست پرواز در حال بررسی است. برای پیگیری از همین صفحه استفاده کنید.";
    if (flight.state === "draft" && flight.contractNumber) {
      const status = await read<{state: string}>(path + "/settlement", signal).catch(() => null);
      next = status?.state === "settled" ? "تسویهٔ این پرواز تأیید شده است." : status?.state === "cancelled" ? labels.cancelled :
        status?.state === "unpaid" ? "قرارداد ثبت شده و تسویه هنوز تأیید نشده است. برای هماهنگی پرداخت با پشتیبانی تماس بگیرید." : "قرارداد ثبت شده است. وضعیت تسویه فعلاً در دسترس نیست. دوباره بررسی کنید.";
    }
    return { title: flight.routeLabel || "سفارش پرواز", reference: flight.contractNumber || id,
      referenceLabel: flight.contractNumber ? "شماره قرارداد" : "شناسهٔ پیگیری",
      amount: details?.totals.map(item => formatPaymentAmount(item.amount, item.currency)).join(" + ") || "در دست بررسی", next };
  }
  const booking = await read<Booking>("/account/bookings/" + id, signal);
  const due = Number(booking.payableNowAmount ?? booking.totalAmount);
  let next = labels[booking.status] ?? "وضعیت سفارش در دست بررسی است.";
  let payable: number | undefined;
  if (booking.status === "approved") {
    const expired = booking.paymentExpiresAt && Date.parse(booking.paymentExpiresAt) <= Date.now();
    if (expired) next = labels.expired;
    else if (booking.paymentMethod === "agency_credit") next = "تسویه از اعتبار حساب آژانس پیگیری می‌شود.";
    else if (!(due > 0)) next = "مبلغی برای پرداخت آنلاین اعلام نشده است.";
    else {
      const config = await read<{enabled: boolean}>("/payments/configuration", signal).catch(() => null);
      if (config?.enabled && booking.currency === "IRT") { payable = due; next = "سفارش تأیید شده است. برای پرداخت مبلغ قابل پرداخت وارد درگاه شوید."; }
      else next = config === null ? "وضعیت درگاه دریافت نشد. دوباره بررسی کنید." : "سفارش تأیید شده است. برای هماهنگی پرداخت با پشتیبانی تماس بگیرید.";
    }
  }
  return { title: booking.items.map(item => item.titleSnapshot).join("، ") || "سفارش سفر", reference: booking.bookingNumber,
    referenceLabel: "شمارهٔ رزرو", amount: booking.totalAmount == null ? "در دست بررسی" : formatPaymentAmount(booking.totalAmount, booking.currency), next, payable, booking };
}

export function OrderPaymentStatus({ kind, id }: Props) {
  const [view, setView] = useState<View | null>(null);
  const [attempt, retry] = useState(0);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    loadOrder({kind, id}, controller.signal).then(value => {
      if (!controller.signal.aborted) setView(value);
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [kind, id, attempt]);
  function refresh() { setView(null); setError(""); retry(value => value + 1); }
  async function pay() {
    if (!view?.booking || !view.payable || lock.current) return;
    lock.current = true; setPaying(true);
    try {
      const response = await fetch(PUBLIC_API_BASE_URL + "/payments/intents", { method: "POST", credentials: "include",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({crmContractNumber: view.reference, amount: view.payable, currency: view.booking.currency}) });
      const data = await response.json();
      if (response.ok && data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
      setView(null); setError(response.status === 409 ? "changed" : String(response.status));
    } catch { setView(null); setError("network"); }
    finally { lock.current = false; setPaying(false); }
  }
  if (error === "401" || error === "403") return <Link className="font-bold underline" href={"/account/?next=" + encodeURIComponent("/payment/waiting/?" + kind + "=" + id)}>برای مشاهدهٔ این سفارش وارد حساب خریدار شوید</Link>;
  if (error || !view) return <div role="status">{!error ? "در حال دریافت وضعیت سفارش…" : error === "404" ? "این سفارش در حساب شما پیدا نشد." : error === "changed" ? "وضعیت پرداخت یا مبلغ تغییر کرده است. پیش از پرداخت دوباره سفارش را بررسی کنید." : "ارتباط با سرویس سفارش یا پرداخت برقرار نشد."} {error && <button onClick={refresh} className="underline">بررسی دوباره</button>}</div>;
  return <section className="grid gap-4 rounded-2xl border border-border p-5 text-brand" aria-live="polite">
    <h2 className="text-lg font-black">{view.title}</h2>
    <p>{view.referenceLabel} · <bdi>{view.reference}</bdi></p><p>مبلغ کل · <strong>{view.amount}</strong></p>
    <p className="rounded-xl bg-brand-soft p-3">{view.next}</p>
    {view.payable && view.booking && <button disabled={paying} className="min-h-11 rounded-xl bg-brand px-5 font-bold text-white" onClick={() => void pay()}>{paying ? "در حال اتصال…" : "پرداخت " + formatPaymentAmount(view.payable, view.booking.currency)}</button>}
    {view.booking?.tickets?.map(ticket => <a key={ticket.id} className="underline" href={PUBLIC_API_BASE_URL + "/account/bookings/" + id + "/tickets/" + ticket.id + "/pdf"}>دریافت بلیت {ticket.ticketNumber}</a>)}
    <div className="flex flex-wrap gap-5"><button disabled={paying} className="underline" onClick={refresh}>به‌روزرسانی وضعیت</button><Link href="/contact/" className="underline">تماس با پشتیبانی</Link></div>
  </section>;
}
