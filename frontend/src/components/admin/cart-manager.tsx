"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { adminClientFetch } from "@/lib/admin-client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";

type CartItem = {
  id: number;
  itemType: string;
  titleSnapshot: string;
  detailsSnapshot: string | null;
  roomSelection: Record<string, number>;
  status: string;
  priceAmount: string | null;
  currency: string | null;
  currentPriceAmount: string | null;
  currentCurrency: string | null;
};

type CartEvent = {
  id: number;
  eventType: string;
  actorType: string;
  note: string | null;
  createdAt: string;
};

type Passenger = {
  fullName: string;
  passengerType: string;
  age: number | null;
  nationalCodeMasked: string | null;
  passportNumberMasked: string | null;
  documentsComplete: boolean;
};

type Booking = {
  id: number;
  bookingNumber: string;
  status: string;
  currency: string;
  subtotalAmount: string | null;
  discountAmount: string;
  discountCode: string | null;
  taxAmount: string;
  serviceFeeAmount: string;
  totalAmount: string | null;
  payableNowAmount: string | null;
  paymentMethod: string;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  capacityReservedAt: string | null;
  capacityReleasedAt: string | null;
  customerNote: string | null;
  adminNote: string | null;
  passengers: Passenger[];
  documentsPending: number;
};

type Payment = {
  id: number;
  amount: string;
  currency: string;
  status: string;
  provider: string | null;
  providerReference: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
  refundedAmount: string;
  createdAt: string;
};

type Cart = {
  id: number;
  status: string;
  operationalStatus: string;
  subtotalAmount: string | null;
  discountAmount: string;
  totalAmount: string | null;
  currency: string;
  expiresAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  convertedBookingId: number | null;
  assignedAdminId: number | null;
  customer: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    lastLoginAt: string | null;
  };
  items: CartItem[];
  events: CartEvent[];
  booking: Booking | null;
  payments: Payment[];
  paidAmount: string;
  remainingAmount: string | null;
  destinations: string[];
  travelDates: string[];
  capacitySummary: string[];
  alerts: string[];
};

type OperationalStatus =
  | "all"
  | "active"
  | "abandoned"
  | "awaiting_payment"
  | "payment_failed"
  | "converted"
  | "expired"
  | "cancelled";

const tabs: ReadonlyArray<[OperationalStatus, string]> = [
  ["all", "همه"],
  ["active", "فعال"],
  ["abandoned", "رهاشده"],
  ["awaiting_payment", "در انتظار پرداخت"],
  ["payment_failed", "پرداخت ناموفق"],
  ["converted", "تبدیل‌شده"],
  ["expired", "منقضی"],
  ["cancelled", "لغوشده"],
];

const statusLabels: Record<string, string> = {
  active: "فعال",
  abandoned: "رهاشده",
  awaiting_payment: "در انتظار پرداخت",
  payment_failed: "پرداخت ناموفق",
  converted: "تبدیل‌شده به سفارش",
  expired: "منقضی",
  cancelled: "لغوشده",
  pending_review: "در انتظار بررسی",
  approved: "تأییدشده",
  paid: "پرداخت‌شده",
  failed: "ناموفق",
  pending: "در انتظار",
  crm_sync_pending: "در حال ثبت",
  crm_synced: "ثبت‌شده",
  partially_refunded: "بازپرداخت جزئی",
};

const itemStatus: Record<string, string> = {
  active: "تأییدشده",
  price_changed: "تغییر قیمت",
  availability_check_required: "نیازمند بررسی",
  unavailable: "ناموجود",
  expired: "منقضی",
  converted: "ارسال‌شده برای رزرو",
  cancelled: "لغوشده",
};

const productLabels: Record<string, string> = {
  tour: "تور",
  flight: "پرواز",
  train: "قطار",
  bus: "اتوبوس",
};

function money(value: string | null | undefined, currency: string | null | undefined) {
  return value && currency ? formatCurrency(value, currency) : "نیازمند استعلام";
}

function responseMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body && "detail" in body && typeof body.detail === "string"
    ? body.detail
    : fallback;
}

function dateMatches(dates: string[], from: string, to: string) {
  return !from && !to || dates.some((value) => (!from || value >= from) && (!to || value <= to));
}

export function CartManager({ initial }: { initial: Cart[] }) {
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<OperationalStatus>("all");
  const [query, setQuery] = useState("");
  const [productType, setProductType] = useState("all");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [travelFrom, setTravelFrom] = useState("");
  const [travelTo, setTravelTo] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa-IR");
    return rows.filter((cart) => {
      const searchable = [
        String(cart.id),
        cart.customer.fullName,
        cart.customer.email,
        cart.customer.phone ?? "",
        ...cart.destinations,
        ...cart.items.flatMap((item) => [item.titleSnapshot, item.detailsSnapshot ?? ""]),
      ].join(" ").toLocaleLowerCase("fa-IR");
      const total = Number(cart.booking?.totalAmount ?? cart.totalAmount ?? 0);
      return (selected === "all" || cart.operationalStatus === selected)
        && (!normalized || searchable.includes(normalized))
        && (productType === "all" || cart.items.some((item) => item.itemType === productType))
        && (!amountFrom || total >= Number(amountFrom))
        && (!amountTo || total <= Number(amountTo))
        && dateMatches(cart.travelDates, travelFrom, travelTo);
    });
  }, [amountFrom, amountTo, productType, query, rows, selected, travelFrom, travelTo]);

  async function perform(cart: Cart, path: string, body?: Record<string, unknown>) {
    setBusy(cart.id);
    try {
      const response = await adminClientFetch(`/admin/carts/${cart.id}/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(payload, "ثبت عملیات ناموفق بود."));
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "ثبت عملیات ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  async function followUp(cart: Cart) {
    const note = window.prompt("یادداشت داخلی پیگیری", "تماس برای بررسی قیمت و ظرفیت")?.trim();
    if (note) await perform(cart, "follow-up", { note });
  }

  async function remind(cart: Cart) {
    const defaultMessage = cart.booking
      ? "برای تکمیل پرداخت و مشاهده جزئیات رزرو، لطفاً وارد حساب کاربری شوید."
      : "سبد سفر شما ذخیره شده است؛ برای تکمیل خرید وارد سبد خرید شوید.";
    const message = window.prompt("متن یادآوری درون‌حسابی", defaultMessage);
    if (message !== null) await perform(cart, "reminder", { message });
  }

  async function extendHold(cart: Cart) {
    const minutes = window.prompt("مدت تمدید نگه‌داری موقت (دقیقه)", "120");
    if (!minutes) return;
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 15 || value > 1440) {
      window.alert("مدت تمدید باید بین ۱۵ دقیقه تا ۲۴ ساعت باشد.");
      return;
    }
    await perform(cart, "extend-hold", { minutes: value });
  }

  async function cancel(cart: Cart) {
    if (window.confirm("سبد و انتخاب‌های فعال آن لغو شود؟")) await perform(cart, "cancel");
  }

  async function hideFromAdminList(cart: Cart) {
    if (!window.confirm("این سبد فقط از فهرست مدیریت پنهان شود؟ اطلاعات فروش و پشتیبانی حذف نمی‌شود.")) return;
    setBusy(cart.id);
    try {
      const response = await adminClientFetch(`/admin/carts/${cart.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseMessage(payload, "حذف از فهرست ناموفق بود."));
      setRows((current) => current.filter((row) => row.id !== cart.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "حذف از فهرست ناموفق بود.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-7">
          <label className="grid min-w-0 gap-1 text-sm font-bold text-brand 2xl:col-span-2">
            جست‌وجوی مشتری، مقصد یا شماره سبد
            <input className="min-h-11 min-w-0 w-full rounded-xl border border-border px-3 text-base font-normal" onChange={(event) => setQuery(event.target.value)} placeholder="نام، تلفن، ایمیل یا مقصد" value={query} />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-bold text-brand">
            نوع محصول
            <select className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-white px-3 font-normal" onChange={(event) => setProductType(event.target.value)} value={productType}>
              <option value="all">همه محصولات</option>
              {Object.entries(productLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-bold text-brand">
            مبلغ از
            <input className="min-h-11 min-w-0 w-full rounded-xl border border-border px-3 font-normal" inputMode="numeric" min="0" onChange={(event) => setAmountFrom(event.target.value)} placeholder="تومان" type="number" value={amountFrom} />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-bold text-brand">
            مبلغ تا
            <input className="min-h-11 min-w-0 w-full rounded-xl border border-border px-3 font-normal" inputMode="numeric" min="0" onChange={(event) => setAmountTo(event.target.value)} placeholder="تومان" type="number" value={amountTo} />
          </label>
          <div className="grid min-w-0 grid-cols-2 gap-2 2xl:col-span-2">
            <label className="grid min-w-0 gap-1 text-sm font-bold text-brand">
              <span>تاریخ سفر از</span>
              <JalaliDateInput ariaLabel="تاریخ سفر از" className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal" onChange={(value) => setTravelFrom(value ?? "")} value={travelFrom || null} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-bold text-brand">
              <span>تا</span>
              <JalaliDateInput ariaLabel="تاریخ سفر تا" className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal" onChange={(value) => setTravelTo(value ?? "")} value={travelTo || null} />
            </label>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map(([value, label]) => <button aria-pressed={selected === value} className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-black ${selected === value ? "bg-brand text-white" : "text-muted hover:bg-surface-muted"}`} key={value} onClick={() => setSelected(value)} type="button">{label} ({rows.filter((row) => value === "all" || row.operationalStatus === value).length.toLocaleString("fa-IR")})</button>)}
        </div>
      </section>

      <p className="text-sm font-bold text-muted">{visible.length.toLocaleString("fa-IR")} سبد با فیلترهای فعلی نمایش داده می‌شود.</p>
      <div className="grid gap-4">
        {visible.map((cart) => {
          const booking = cart.booking;
          const canManageHold = ["active", "abandoned"].includes(cart.status);
          const total = booking?.totalAmount ?? cart.totalAmount;
          const currency = booking?.currency ?? cart.currency;
          return <article className="rounded-3xl border border-border bg-white p-4 shadow-sm sm:p-6" key={cart.id}>
            <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-brand">سبد #{cart.id.toLocaleString("fa-IR")} · {cart.customer.fullName}</h2><span className={`rounded-full px-3 py-1 text-xs font-black ${["active", "converted"].includes(cart.operationalStatus) ? "bg-emerald-50 text-emerald-700" : cart.operationalStatus === "payment_failed" ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{statusLabels[cart.operationalStatus] ?? cart.operationalStatus}</span></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted"><span>کاربر #{cart.customer.id.toLocaleString("fa-IR")}</span><a className="underline" href={`mailto:${cart.customer.email}`}>{cart.customer.email}</a>{cart.customer.phone ? <a className="underline" dir="ltr" href={`tel:${cart.customer.phone}`}>{cart.customer.phone}</a> : null}</div>
                <p className="mt-1 text-xs text-muted">آخرین فعالیت: {formatPersianDate(cart.lastActivityAt)} · آخرین ورود: {cart.customer.lastLoginAt ? formatPersianDate(cart.customer.lastLoginAt) : "ثبت نشده"}</p>
              </div>
              <div className="text-right lg:text-left"><strong className="block text-lg text-brand">{money(total, currency)}</strong><span className="text-xs text-muted">پرداخت‌شده: {money(cart.paidAmount, currency)} · مانده: {money(cart.remainingAmount, currency)}</span></div>
            </header>

            {cart.alerts.length ? <ul className="mt-4 grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{cart.alerts.map((alert) => <li key={alert}>هشدار: {alert}</li>)}</ul> : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {cart.items.map((item) => <section className="rounded-2xl bg-surface-muted p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><strong className="text-brand">{productLabels[item.itemType] ?? item.itemType} · {item.titleSnapshot}</strong><p className="mt-1 text-sm text-muted">{item.detailsSnapshot ?? "—"}</p></div><span className={`rounded-lg px-2 py-1 text-xs font-bold ${item.status === "price_changed" ? "bg-pink-100 text-pink-700" : "bg-white text-muted"}`}>{itemStatus[item.status] ?? item.status}</span></div><p className="mt-3 text-sm font-bold">{item.status === "price_changed" ? <><del className="text-muted">{money(item.priceAmount, item.currency ?? currency)}</del><span className="mr-2 text-pink-700">{money(item.currentPriceAmount, item.currentCurrency ?? currency)}</span></> : money(item.priceAmount, item.currency ?? currency)}</p>{Object.values(item.roomSelection ?? {}).some(Boolean) ? <p className="mt-2 text-xs text-muted">انتخاب اتاق ثبت شده است.</p> : null}</section>)}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
              <section className="rounded-2xl border border-brand/15 p-4">
                <h3 className="font-black text-brand">مالی، ظرفیت و زمان‌بندی</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">قیمت پایه</dt><dd className="mt-1 font-black">{money(booking?.subtotalAmount ?? cart.subtotalAmount, currency)}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">تخفیف</dt><dd className="mt-1 font-black">{money(booking?.discountAmount ?? cart.discountAmount, currency)}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">مالیات و خدمات</dt><dd className="mt-1 font-black">{booking ? money(String(Number(booking.taxAmount) + Number(booking.serviceFeeAmount)), currency) : "—"}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">مبلغ نهایی</dt><dd className="mt-1 font-black">{money(total, currency)}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">کد تخفیف</dt><dd className="mt-1 font-black">{booking?.discountCode ?? "—"}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">اعتبار نگه‌داری</dt><dd className="mt-1 font-black">{booking?.paymentExpiresAt ? formatPersianDate(booking.paymentExpiresAt) : cart.expiresAt ? formatPersianDate(cart.expiresAt) : "—"}</dd></div></dl>
                <div className="mt-3 grid gap-2 text-sm text-muted"><p>ایجاد سبد: {formatPersianDate(cart.createdAt)} · آخرین تغییر: {formatPersianDate(cart.updatedAt)}</p><p>مقصد: {cart.destinations.join("، ") || "—"} · تاریخ سفر: {cart.travelDates.map((value) => formatPersianDate(value)).join("، ") || "—"}</p>{cart.capacitySummary.map((capacity) => <p className="font-bold text-brand" key={capacity}>{capacity}</p>)}</div>
              </section>

              <section className="rounded-2xl border border-border p-4"><h3 className="font-black text-brand">اقدام‌های فروش</h3><div className="mt-3 grid gap-2"><button className="min-h-10 rounded-xl border border-brand/30 px-3 text-sm font-black text-brand disabled:opacity-50" disabled={busy === cart.id} onClick={() => void followUp(cart)} type="button">ثبت یادداشت داخلی</button><button className="min-h-10 rounded-xl bg-brand px-3 text-sm font-black text-white disabled:opacity-50" disabled={busy === cart.id} onClick={() => void remind(cart)} type="button">ارسال یادآوری درون‌حسابی</button>{canManageHold ? <button className="min-h-10 rounded-xl border border-emerald-300 px-3 text-sm font-black text-emerald-700 disabled:opacity-50" disabled={busy === cart.id} onClick={() => void extendHold(cart)} type="button">تمدید نگه‌داری موقت</button> : null}{canManageHold ? <button className="min-h-10 rounded-xl border border-rose-300 px-3 text-sm font-black text-rose-700 disabled:opacity-50" disabled={busy === cart.id} onClick={() => void cancel(cart)} type="button">لغو و آزادسازی سبد</button> : null}{booking ? <><Link className="min-h-10 rounded-xl bg-surface-muted px-3 py-2 text-center text-sm font-black text-brand" href="/admin/bookings/">بررسی رزرو، قیمت و تأیید دستی</Link><Link className="min-h-10 rounded-xl bg-surface-muted px-3 py-2 text-center text-sm font-black text-brand" href="/admin/checkout/">مدارک، پرداخت و بازگشت وجه</Link></> : null}<button className="min-h-10 rounded-xl border border-rose-300 px-3 text-sm font-black text-rose-700 disabled:opacity-50" disabled={busy === cart.id} onClick={() => void hideFromAdminList(cart)} type="button">حذف از فهرست مدیریت</button></div></section>
            </div>

            {booking ? <section className="mt-4 rounded-2xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-brand">رزرو {booking.bookingNumber} · {statusLabels[booking.status] ?? booking.status}</h3><span className="text-sm text-muted">روش پرداخت: {booking.paymentMethod === "installment" ? "اقساطی" : "نقدی"}</span></div>{booking.customerNote ? <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">درخواست مشتری: {booking.customerNote}</p> : null}{booking.adminNote ? <p className="mt-2 rounded-xl bg-brand-soft p-3 text-sm">یادداشت تیم: {booking.adminNote}</p> : null}<div className="mt-3 grid gap-3 lg:grid-cols-2"><div><h4 className="text-sm font-black text-brand">مسافران ({booking.passengers.length.toLocaleString("fa-IR")})</h4><div className="mt-2 grid gap-2">{booking.passengers.map((passenger, index) => <div className="rounded-xl bg-surface-muted p-3 text-sm" key={`${passenger.fullName}-${index}`}><strong>{passenger.fullName}</strong><span className="mr-2 text-muted">{passenger.passengerType} · {passenger.age ?? "سن ثبت نشده"}</span><p className="mt-1 text-xs text-muted">کد ملی: {passenger.nationalCodeMasked ?? "ثبت نشده"} · گذرنامه: {passenger.passportNumberMasked ?? "ثبت نشده"} · {passenger.documentsComplete ? "کامل" : "نیازمند تکمیل"}</p></div>)}</div></div><div><h4 className="text-sm font-black text-brand">تلاش‌های پرداخت ({cart.payments.length.toLocaleString("fa-IR")})</h4><div className="mt-2 grid gap-2">{cart.payments.map((payment) => <div className="rounded-xl bg-surface-muted p-3 text-sm" key={payment.id}><strong>{statusLabels[payment.status] ?? payment.status} · {money(payment.amount, payment.currency)}</strong><p className="mt-1 text-xs text-muted">{payment.provider ?? "درگاه نامشخص"}{payment.providerReference ? ` · ${payment.providerReference}` : ""} · {formatPersianDate(payment.createdAt)}</p>{payment.failureReason ? <p className="mt-1 text-xs text-rose-700">علت خطا: {payment.failureReason}</p> : null}</div>)}{!cart.payments.length ? <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted">تلاش پرداختی ثبت نشده است.</p> : null}</div></div></div></section> : null}

            <footer className="mt-4"><details><summary className="cursor-pointer text-sm font-black text-brand">رویدادها و تاریخچه ({cart.events.length.toLocaleString("fa-IR")})</summary><ol className="mt-3 grid gap-2 border-r-2 border-brand/15 pr-4 text-sm">{cart.events.slice(0, 12).map((event) => <li key={event.id}><strong>{event.eventType}</strong><span className="mr-2 text-muted">{event.note ?? "—"} · {formatPersianDate(event.createdAt)}</span></li>)}</ol></details></footer>
          </article>;
        })}
        {!visible.length ? <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-muted">سبدی با این فیلترها وجود ندارد.</p> : null}
      </div>
    </div>
  );
}
