"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { FlightTimeline, type FlightTimelineLeg } from "@/components/content/erp-flight-result-card";
import { ArrowLeftIcon, ClipboardIcon, FlightTicketIcon, UsersIcon } from "@/components/layout/site-icons";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { readCustomerSession } from "@/lib/customer-session";
import { readPendingErpCheckout, type ErpFlightCheckoutResult, type PendingErpFlightCheckout } from "@/lib/erp-flight-checkout-recovery";
import { formatPersianDate, formatPersianDateTime } from "@/lib/persian-date";

export type FlightCartOrder = ErpFlightCheckoutResult & { routeLabel?: string | null; createdAt: string };

export function ErpFlightOrders({
  cart = false,
  empty,
  onSelect,
}: {
  cart?: boolean;
  empty?: ReactNode;
  onSelect?: (order: FlightCartOrder, payable: boolean) => void;
} = {}) {
  const [orders, setOrders] = useState<FlightCartOrder[] | null>(null);
  const [problem, setProblem] = useState(false);
  const [pending, setPending] = useState<PendingErpFlightCheckout | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    if (!cart) void readCustomerSession().then(async (session) => {
      if (!session.ok) return;
      const { user } = await session.json();
      if (!controller.signal.aborted && typeof user?.id === "number") {
        setPending(readPendingErpCheckout(window.localStorage, user.id));
      }
    }).catch(() => {});
    fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts`, {
      credentials: "include", cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (cart && response.status === 401) { setOrders([]); return; }
      if (!response.ok) throw new Error("Unable to load flight orders");
      const data: unknown = await response.json();
      if (Array.isArray(data)) setOrders(data);
    }).catch(() => { if (!controller.signal.aborted) setProblem(true); });
    return () => controller.abort();
  }, [cart]);

  async function checkSettlement(order: FlightCartOrder) {
    setStatuses((current) => ({ ...current, [order.id]: "در حال بررسی…" }));
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/${order.id}/settlement`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load settlement");
      const data = await response.json();
      const status = data.state === "settled" ? "تسویه در آوینا تأیید شد" : data.state === "cancelled" ? "لغوشده در آوینا" : "تسویه تأیید نشده";
      setStatuses((current) => ({ ...current, [order.id]: status }));
    } catch {
      setStatuses((current) => ({ ...current, [order.id]: "بررسی وضعیت انجام نشد." }));
    }
  }

  const visibleOrders = cart ? orders?.filter((order) => order.state === "draft") : orders;
  if (cart && !problem && visibleOrders?.length === 0) return empty ?? null;

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4" aria-label={cart ? "پروازهای ثبت‌شده" : "درخواست‌های پرواز"}>
      <h2 className="font-bold text-brand">{cart ? "پروازهای ثبت‌شده" : "درخواست‌های پرواز"}</h2>
      {problem ? <p className="mt-2 text-sm text-muted">دریافت درخواست‌ها انجام نشد.</p> : null}
      {!problem && !orders ? <p className="mt-2 text-sm text-muted">در حال دریافت درخواست‌ها…</p> : null}
      {orders?.length === 0 && !pending ? <p className="mt-2 text-sm text-muted">هنوز درخواست پروازی برای این حساب ثبت نشده است.</p> : null}
      {visibleOrders?.length ? <ul className={cart ? "mt-2 min-w-0 overflow-x-auto divide-y divide-border" : "mt-3 grid min-w-0 gap-4"}>
        {visibleOrders.map((order) => (
          <li key={order.id} className={cart ? "flex min-w-max items-center justify-between gap-3 whitespace-nowrap py-3 text-sm" : "flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-4 text-sm"}>
            {!cart && <AccountFlightLegs orderId={order.id} />}
            <strong>{order.routeLabel || "درخواست پرواز"}</strong>
            {order.contractNumber ? <bdi>شماره قرارداد {order.contractNumber}</bdi> : null}
            <span className="text-muted">{formatPersianDateTime(order.createdAt)}</span>
            {!order.contractNumber && <small className="w-full break-all text-muted">شناسهٔ پیگیری <bdi>{order.id}</bdi></small>}
            <span aria-live="polite">{statuses[order.id] || (order.state === "cancelled" ? "لغوشده در آوینا" : order.state === "draft" ? "درخواست ثبت شده" : order.state === "failed" ? "ثبت انجام نشد" : "در حال ثبت")}</span>
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-bold text-white" href={`/payment/waiting/?flight=${encodeURIComponent(order.id)}`}>{!cart && order.state === "draft" && order.contractNumber ? "ادامه خرید و وضعیت پرداخت" : "پیگیری سفارش"}</Link>
            {onSelect && <button type="button" className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white" onClick={() => onSelect(order, !!order.contractNumber && !["تسویه در آوینا تأیید شد", "لغوشده در آوینا"].includes(statuses[order.id]))}>جزئیات</button>}
            {order.state === "draft" && order.contractNumber ? (
              <button type="button" disabled={statuses[order.id] === "در حال بررسی…"} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-bold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60" onClick={() => void checkSettlement(order)}>بررسی وضعیت تسویه</button>
            ) : null}
            {pending?.key === order.id && order.state !== "draft" && order.state !== "cancelled" && <Link className="font-bold text-brand underline" href="#flight-request-recovery">پیگیری درخواست</Link>}
          </li>
        ))}
      </ul> : null}
    </section>
  );
}

function AccountFlightLegs({ orderId }: { orderId: string }) {
  const [legs, setLegs] = useState<FlightTimelineLeg[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/${encodeURIComponent(orderId)}/details`, {
          credentials: "include", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("flight details");
        const details: Details = await response.json();
        setLegs(details.legs ?? []);
      } catch {
        if (!controller.signal.aborted) setLegs([]);
      }
    }
    void load();
    return () => controller.abort();
  }, [orderId]);
  return <div className="grid w-full min-w-0 gap-2">
    {legs?.map((leg, index) => <FlightTimeline key={index} leg={leg} label={index ? "پرواز برگشت" : "پرواز رفت"} detailed />)}
    {!legs && <p role="status" className="text-sm text-muted">در حال دریافت مشخصات پرواز…</p>}
    {legs?.length === 0 && <p className="text-sm text-muted">جزئیات مسیر در دسترس نیست.</p>}
  </div>;
}

type Details = {
  legs: FlightTimelineLeg[];
  totals: {amount: string; currency: string}[];
  passengers: {firstName: string; lastName: string; firstNameEn?: string; lastNameEn?: string; birthDate?: string}[];
};

export function FlightCartDetails({
  order,
  step,
  onStep,
  onBackToCart,
  payable,
}: {
  order: FlightCartOrder;
  step: number;
  onStep: (step: number) => void;
  onBackToCart: () => void;
  payable: boolean;
}) {
  const [data, setData] = useState<Details | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, retry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${PUBLIC_API_BASE_URL}/account/erp-flight-checkouts/${order.id}/details`, {
      credentials: "include", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error();
      setData(await response.json());
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [order.id, attempt]);
  const action = "inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 font-bold text-white hover:bg-brand-strong";
  const showFlight = step === 0 || step === 3;
  const showPassengers = step === 1 || step === 3;

  return (
    <section className="space-y-4 text-brand" aria-labelledby="cart-flight-detail-title">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/10 bg-brand-soft p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <FlightTicketIcon aria-hidden className="size-5" />
          </span>
          <div>
            <h2 ref={heading} tabIndex={-1} id="cart-flight-detail-title" className="scroll-mt-28 text-xl font-black sm:text-2xl">
              {["جزئیات خرید پرواز", "اطلاعات مسافران", "درخواست ثبت‌شده", "تأیید نهایی"][step]}
            </h2>
            {order.routeLabel && <p className="mt-1 text-sm text-muted">{order.routeLabel}</p>}
          </div>
        </div>
        <button type="button" className="min-h-11 rounded-xl border border-border bg-white px-4 text-sm font-bold hover:bg-surface-muted" onClick={onBackToCart}>
          بازگشت به سفارش‌ها
        </button>
      </header>

      {failed ? (
        <p role="alert" className="rounded-xl border border-border bg-surface p-4">
          دریافت اطلاعات انجام نشد. <button type="button" className="underline" onClick={() => { setFailed(false); retry((count) => count + 1); }}>تلاش دوباره</button>
        </p>
      ) : !data ? (
        <p role="status" className="rounded-xl border border-border bg-surface p-4">در حال دریافت اطلاعات…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
          <div className="min-w-0 space-y-4">
            {showFlight && (
              <section className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
                <h3 className="font-black">مسیر پرواز</h3>
                {data.legs.map((leg, index) => (
                  <FlightTimeline key={`${leg.service_number}-${leg.departure}-${index}`} leg={leg} label={index ? "پرواز برگشت" : "پرواز رفت"} detailed />
                ))}
                {!data.legs.length && <p className="text-sm text-muted">جزئیات مسیر برای این سفارش در دسترس نیست.</p>}
              </section>
            )}
            {showPassengers && (
              <section className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="flex items-center gap-2 font-black"><UsersIcon aria-hidden className="size-5" /> مشخصات مسافران</h3>
                {data.passengers.length ? (
                  <ol className="mt-3 grid gap-3">
                    {data.passengers.map((passenger, index) => (
                      <li key={index} className="flex items-start gap-3 rounded-xl bg-surface-muted p-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-black">{(index + 1).toLocaleString("fa-IR")}</span>
                        <div className="min-w-0">
                          <strong className="break-words">{passenger.firstName} {passenger.lastName}</strong>
                          {(passenger.firstNameEn || passenger.lastNameEn) && <p className="break-words text-sm text-muted"><bdi>{passenger.firstNameEn} {passenger.lastNameEn}</bdi></p>}
                          {passenger.birthDate && <p className="mt-1 text-sm text-muted">تاریخ تولد · {formatPersianDate(passenger.birthDate)}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm text-muted">اطلاعات مسافر برای این سفارش در دسترس نیست.</p>}
              </section>
            )}
            {step === 2 && (
              <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <ClipboardIcon aria-hidden className="size-6 shrink-0" />
                <div>
                  <h3 className="font-black">درخواست پرواز ثبت شده است</h3>
                  <p className="mt-1 text-sm">زمان ثبت · {formatPersianDateTime(order.createdAt)}</p>
                </div>
              </section>
            )}
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-surface p-4" aria-label="خلاصه سفارش">
            <h3 className="font-black">خلاصه سفارش</h3>
            <dl className="mt-4 space-y-3 text-sm">
              {order.contractNumber && (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted">شماره قرارداد</dt><dd className="font-bold"><bdi>{order.contractNumber}</bdi></dd>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">مسافران</dt><dd className="font-bold">{data.passengers.length.toLocaleString("fa-IR")} نفر</dd>
              </div>
              <div className="space-y-1 border-t border-border pt-3">
                <dt className="text-muted">مبلغ کل سفارش</dt>
                <dd className="text-lg font-black">
                  {data.totals.length ? data.totals.map((total) => (
                    <span key={total.currency} className="block">{Number(total.amount).toLocaleString("fa-IR")} {total.currency === "IRR" ? "ریال" : total.currency}</span>
                  )) : "در دسترس نیست"}
                </dd>
              </div>
            </dl>
            <footer className="mt-4 grid gap-2">
              {step < 3 ? (
                <button type="button" className={action} onClick={() => onStep(step + 1)}>
                  {["ادامه به اطلاعات مسافران", "مشاهده درخواست ثبت‌شده", "مرور نهایی سفارش"][step]}
                  <ArrowLeftIcon aria-hidden className="mr-2 size-4 shrink-0" />
                </button>
              ) : payable && <Link href={`/payment/waiting/?flight=${encodeURIComponent(order.id)}`} className={action}>وضعیت سفارش و پرداخت</Link>}
              {step > 0 && <button type="button" className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold" onClick={() => onStep(step - 1)}>مرحله قبل</button>}
            </footer>
          </aside>
        </div>
      )}
    </section>
  );
}
