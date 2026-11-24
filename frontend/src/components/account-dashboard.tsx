"use client";

import { ErpFlightCheckoutRecovery } from "@/components/content/erp-flight-result-card";
import { ErpFlightOrders } from "@/components/content/erp-flight-orders";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { AccountForm } from "@/components/account-form";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { VisaApplicationsPanel } from "@/components/visa-applications-panel";
import { WalletTopUpPanel } from "@/components/wallet-top-up-panel";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDateTime } from "@/lib/persian-date";
import { SiteSelect } from "@/components/ui/site-select";
import { useOnlineSalesEnabled } from "@/components/online-sales-provider";

type Account = {
  accountType: "customer" | "agency";
  email: string;
  fullName: string;
  phone: string | null;
  emergencyPhone: string | null;
  buyerMobile: string | null;
  landline: string | null;
  postalCode: string | null;
  nationalCode: string | null;
  birthDate: string | null;
  address: string | null;
  bankIban: string | null;
  bankAccountNumber: string | null;
  bankCardLast4: string | null;
};
type Wallet = { availableCredit: string; currency: string };
type Agency = {
  id: number;
  legalName: string;
  registrationNumber: string;
  nationalId: string | null;
  economicCode: string | null;
  licenseNumber: string;
  managerName: string;
  phone: string;
  province: string;
  city: string;
  status: "pending" | "approved" | "rejected";
  creditLimit: string;
  creditUsed: string;
  creditReserved: string;
  availableCredit: string;
  currency: string;
  reviewNote: string | null;
};
type CartItem = { id: number; titleSnapshot: string; priceAmount: string | null; currency: string | null };
type SavedTour = { id: number; tourId: number; title: string; slug: string; priceAmount: string | null; currency: string | null };
type OrderServiceItem = { title: string; details: string | null };
type PaymentStartResponse = { checkoutUrl?: string | null; detail?: string }; 
type Order = {
  id: number;
  orderNumber: string;
  title: string | null;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  serviceItems: OrderServiceItem[];
  passengerCount: number;
  paymentExpiresAt: string | null;
  ticketsIssued: boolean;
  source: "payment" | "booking";
};
type Passenger = { id: number; fullName: string; firstName: string | null; lastName: string | null; firstNameEn: string | null; lastNameEn: string | null; nationalCode: string | null; passportNumber: string | null; passportExpiryDate: string | null; email: string | null; gender: "male" | "female" | "unspecified"; age: number | null; birthDate: string | null; phone: string | null; hasPet: boolean; petName: string | null; petType: string | null; petWeightKg: string | null; isDefault: boolean };
type SupportMessage = { id: number; senderType: "customer" | "bot" | "admin"; body: string; createdAt: string };
type SupportRequest = { id: number; subject: string; message: string; status: string; createdAt: string; messages: SupportMessage[] };
type AvailabilityAlert = { id: number; serviceType: string; origin: string; destination: string; departureDate: string; isActive: boolean };
type Insurance = { id: number; provider: string; policyNumber: string; coverageTitle: string; coverageAmount: string | null; currency: string; startDate: string; endDate: string; status: "active" | "pending" | "expired" | "cancelled"; createdAt: string };
type Dashboard = { user: Account; wallet: Wallet; agency: Agency | null; cartItems: CartItem[]; savedTours: SavedTour[]; recentOrders: Order[] };
type Section = "profile" | "trips" | "passengers" | "insurance" | "favorites" | "visa" | "support" | "alerts" | "wallet";

const navItems: Array<{ id: Section; label: string; icon: string }> = [
  { id: "profile", label: "حساب کاربری", icon: "◉" },
  { id: "trips", label: "سفرهای من", icon: "◫" },
  { id: "visa", label: "درخواست ویزا", icon: "▣" },
  { id: "support", label: "درخواست پشتیبانی", icon: "◔" },
  { id: "wallet", label: "موجودی و اعتبار من", icon: "¤" },
];
const insuranceStatusLabels: Record<Insurance["status"], string> = {
  active: "فعال",
  pending: "در انتظار صدور",
  expired: "منقضی‌شده",
  cancelled: "لغوشده",
};

const orderStatusLabels: Record<string, string> = {
  pending_review: "در انتظار بررسی کارشناس",
  approved: "تأیید شده و آمادهٔ پرداخت",
  paid: "پرداخت شده",
  rejected: "رد شده",
  expired: "منقضی شده",
  pending: "در انتظار پرداخت",
  succeeded: "پرداخت موفق",
  failed: "پرداخت ناموفق",
  cancelled: "لغو شده",
};


function minimumPassportExpiryDate(): string {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setMonth(value.getMonth() + 4);
  return value.toISOString().slice(0, 10);
}

function persianDate(value: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(value));
}

function FieldLabel({ label, required = false, status }: { label: string; required?: boolean; status?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${required ? "bg-red-50 text-red-700" : "bg-surface-muted text-muted"}`}>
        {status ?? (required ? "الزامی" : "اختیاری")}
      </span>
    </span>
  );
}

function InputField({ label, name, defaultValue, type = "text", placeholder = "", inputMode, required = false, status, min, max, minLength, maxLength, dir }: { label: string; name: string; defaultValue?: string | null; type?: string; placeholder?: string; inputMode?: "numeric" | "decimal" | "email" | "tel" | "text" | "url" | "search" | "none"; required?: boolean; status?: string; min?: number; max?: number; minLength?: number; maxLength?: number; dir?: "ltr" | "rtl" }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-brand">
      <FieldLabel label={label} required={required} status={status} />
      <input className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15" defaultValue={defaultValue ?? ""} dir={dir} inputMode={inputMode} max={max} maxLength={maxLength} min={min} minLength={minLength} name={name} placeholder={placeholder} required={required} type={type} />
    </label>
  );
}
function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-border bg-white p-7 text-center"><div><div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-surface-muted text-2xl text-brand">✦</div><h3 className="font-black text-brand">{title}</h3><p className="mt-2 max-w-md text-sm leading-7 text-muted">{description}</p></div></div>;
}

export function AccountDashboard() {
  const onlineSalesEnabled = useOnlineSalesEnabled();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [active, setActive] = useState<Section>(() => {
    if (typeof window === "undefined") return "profile";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return navItems.some((item) => item.id === tab) ? tab as Section : "profile";
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [passengerSearch, setPassengerSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [alerts, setAlerts] = useState<AvailabilityAlert[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);

  async function request(path: string, options?: RequestInit): Promise<Response | null> {
    return fetch(`${PUBLIC_API_BASE_URL}${path}`, { credentials: "include", ...options }).catch(() => null);
  }

  const loadDashboard = useCallback(async () => {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/dashboard`, {
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") ?? params.get("returnTo");
      if (next?.startsWith("/") && !/^\/[\/\\]/.test(next)) {
        const destination = new URL(next, window.location.origin);
        if (destination.origin === window.location.origin && destination.pathname !== "/account/") {
          router.replace(destination.pathname + destination.search + destination.hash);
          return;
        }
      }
      setDashboard(await response.json() as Dashboard);
    } else setDashboard(null);
    setLoading(false);
  }, [router]);

  async function loadSection(section: Section) {
    if (section === "passengers") {
      const response = await request(`/account/passengers${passengerSearch ? `?query=${encodeURIComponent(passengerSearch)}` : ""}`);
      if (response?.ok) setPassengers(await response.json() as Passenger[]);
    }
    if (section === "insurance") {
      const response = await request("/account/insurances");
      if (response?.ok) setInsurances(await response.json() as Insurance[]);
    }
    if (section === "trips") {
      const response = await request("/account/orders");
      if (response?.ok) setOrders(await response.json() as Order[]);
    }
    if (section === "support") {
      const response = await request("/account/support-requests");
      if (response?.ok) setSupportRequests(await response.json() as SupportRequest[]);
    }
    if (section === "alerts") {
      const response = await request("/account/availability-alerts");
      if (response?.ok) setAlerts(await response.json() as AvailabilityAlert[]);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSection(active); }, 0);
    return () => window.clearTimeout(timer);
    // The section change is the trigger; search refreshes explicitly from its button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const cartTotal = useMemo(() => dashboard?.cartItems.reduce((total, item) => total + Number(item.priceAmount ?? 0), 0) ?? 0, [dashboard]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const textValue = (name: string) => String(form.get(name) ?? "").trim();
    const optionalValue = (name: string) => textValue(name) || null;
    const fullName = textValue("fullName");
    if (fullName.length < 2) {
      setNotice("نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد.");
      return;
    }

    const bankCardNumber = textValue("bankCardNumber");
    const payload = {
      fullName,
      phone: optionalValue("phone"),
      emergencyPhone: optionalValue("emergencyPhone"),
      nationalCode: optionalValue("nationalCode"),
      birthDate: optionalValue("birthDate"),
      address: optionalValue("address"),
      buyerMobile: optionalValue("buyerMobile"),
      landline: optionalValue("landline"),
      postalCode: optionalValue("postalCode"),
      bankIban: optionalValue("bankIban"),
      bankAccountNumber: optionalValue("bankAccountNumber"),
      ...(bankCardNumber ? { bankCardNumber } : {}),
    };

    setNotice("");
    setProfileSaving(true);
    try {
      const response = await request("/account/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response?.ok) {
        setNotice(
          response?.status === 422
            ? "بعضی اطلاعات معتبر نیست؛ تاریخ، کد ملی، شبا و شماره کارت را بررسی کنید."
            : "ذخیره اطلاعات ناموفق بود. دوباره تلاش کنید.",
        );
        return;
      }
      setNotice("اطلاعات حساب کاربری با موفقیت ذخیره شد.");
      await loadDashboard();
    } finally {
      setProfileSaving(false);
    }
  }

  async function addPassenger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await request("/account/passengers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        firstNameEn: form.get("firstNameEn") || null,
        lastNameEn: form.get("lastNameEn") || null,
        nationalCode: form.get("nationalCode") || null,
        passportNumber: form.get("passportNumber") || null,
        passportExpiryDate: form.get("passportExpiryDate") || null,
        email: form.get("email") || null,
        gender: form.get("gender"),
        age: form.get("age") ? Number(form.get("age")) : null,
        birthDate: form.get("birthDate") || null,
        phone: form.get("phone") || null,
        hasPet: form.get("hasPet") === "on",
        petName: form.get("petName") || null,
        petType: form.get("petType") || null,
        petWeightKg: form.get("petWeightKg") ? Number(form.get("petWeightKg")) : null,
        isDefault: form.get("isDefault") === "on",
      }),
    });
    setNotice(response?.ok ? "مسافر جدید ذخیره شد." : "ذخیره مسافر ناموفق بود؛ فیلدهای ضروری و اطلاعات شناسایی را بررسی کنید.");
    if (response?.ok) { event.currentTarget.reset(); await loadSection("passengers"); }
  }
  async function deletePassenger(id: number) {
    const response = await request(`/account/passengers/${id}`, { method: "DELETE" });
    if (response?.ok) await loadSection("passengers");
  }

  async function addInsurance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await request("/account/insurances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.get("provider"),
        policyNumber: form.get("policyNumber"),
        coverageTitle: form.get("coverageTitle"),
        coverageAmount: form.get("coverageAmount") ? Number(form.get("coverageAmount")) : null,
        currency: form.get("currency") || "IRT",
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
        status: form.get("status") || "active",
      }),
    });
    setNotice(response?.ok ? "بیمه‌نامه با موفقیت ثبت شد." : "ثبت بیمه‌نامه ناموفق بود؛ تاریخ‌ها و اطلاعات بیمه را بررسی کنید.");
    if (response?.ok) { event.currentTarget.reset(); await loadSection("insurance"); }
  }

  async function deleteInsurance(id: number) {
    if (!window.confirm("این بیمه‌نامه از پنل شما حذف شود؟")) return;
    const response = await request(`/account/insurances/${id}`, { method: "DELETE" });
    if (response?.ok) {
      setInsurances((current) => current.filter((item) => item.id !== id));
      setNotice("بیمه‌نامه حذف شد.");
    }
  }

  async function saveSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await request("/account/support-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: form.get("subject"), message: form.get("message") }),
    });
    setNotice(response?.ok ? "درخواست پشتیبانی ثبت شد." : "ثبت درخواست ناموفق بود. پیام باید حداقل ۱۰ کاراکتر باشد.");
    if (response?.ok) { event.currentTarget.reset(); await loadSection("support"); }
  }

  async function removeSavedTour(tourId: number) {
    const response = await request(`/account/saved-tours/${tourId}`, { method: "DELETE" });
    if (response?.ok) await loadDashboard();
  }

  async function removeOrder(order: Order) {
    const label = order.source === "booking" ? "رزرو" : "پرداخت";
    if (!window.confirm(`${label} از فهرست سفرهای شما پنهان شود؟ اطلاعات مالی و پشتیبانی حذف نمی‌شود.`)) return;
    const response = await request(`/account/orders/${order.source}/${order.id}`, { method: "DELETE" });
    if (!response?.ok) {
      setNotice("حذف از فهرست سفرها ناموفق بود. دوباره تلاش کنید.");
      return;
    }
    setOrders((current) => current.filter((item) => !(item.source === order.source && item.id === order.id)));
    setNotice("این مورد از فهرست سفرهای شما حذف شد.");
    await loadDashboard();
  }
  async function startPayment(order: Order) {
    setNotice("");
    setPayingOrderId(order.id);
    try {
      const response = await request("/payments/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crmContractNumber: order.orderNumber,
          amount: Number(order.amount),
          currency: order.currency,
        }),
      });
      const body = (await response?.json().catch(() => null)) as PaymentStartResponse | null;
      if (!response?.ok || !body?.checkoutUrl) {
        throw new Error(
          response?.status === 503
            ? "درگاه پرداخت هنوز فعال نشده است."
            : body?.detail || "ورود به درگاه پرداخت ناموفق بود.",
        );
      }
      window.location.assign(body.checkoutUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ورود به درگاه پرداخت ناموفق بود.");
    } finally {
      setPayingOrderId(null);
    }
  }
  async function logout() {
    await request("/account/logout", { method: "POST" });
    window.dispatchEvent(new Event("customer-logged-out"));
    router.replace("/");
  }

  if (loading) return <p className="py-12 text-center text-sm text-muted">در حال دریافت حساب کاربری…</p>;
  if (!dashboard) {
    return (
      <AccountForm
        onAuthenticated={() => {
          setLoading(true);
          void loadDashboard();
        }}
      />
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[230px_minmax(0,1fr)]" dir="rtl">
      <aside className="h-fit rounded-2xl border border-border bg-white p-2 shadow-sm lg:sticky lg:top-24"><div className="border-b border-border px-3 py-4"><p className="font-black text-brand">پنل کاربری</p><p className="mt-1 truncate text-xs text-muted" dir="ltr">{dashboard.user.email}</p></div><nav className="mt-2" aria-label="بخش‌های پنل کاربری">{navItems.map((item) => <button className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-right text-sm font-bold transition ${active === item.id ? "bg-brand text-white" : "text-brand hover:bg-surface-muted"}`} key={item.id} onClick={() => { setActive(item.id); void loadSection(item.id); }} type="button"><span>{item.label}</span><span aria-hidden>{item.icon}</span></button>)}</nav><button className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700" onClick={() => void logout()} type="button"><span>خروج از حساب کاربری</span><span aria-hidden>↩</span></button></aside>
      <main className="min-w-0 space-y-5">
        {notice ? <p role="status" aria-live="polite" aria-atomic="true" className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-bold text-brand">{notice}</p> : null}
        {active === "profile" ? (
          <section className="space-y-5">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div><p className="text-sm text-muted">خوش آمدید</p><h1 className="mt-1 text-2xl font-black text-brand">{dashboard.user.fullName}</h1><p className="mt-1 text-sm text-muted" dir="ltr">{dashboard.user.email}</p>{dashboard.user.accountType === "agency" ? <span className="mt-2 inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">حساب آژانس همکار</span> : null}</div>
                <div className="grid size-14 place-items-center rounded-full bg-brand/10 text-xl font-black text-brand">{dashboard.user.fullName.slice(0, 1)}</div>
              </div>
            </div>
            <form className="space-y-5" onSubmit={saveProfile}>
              <section className="rounded-2xl border border-border bg-white p-5">
                <h2 className="font-black text-brand">اطلاعات حساب کاربری</h2>
                <p className="mt-1 text-sm text-muted">فقط نام و نام خانوادگی الزامی است؛ سایر اطلاعات را می‌توانید بعداً تکمیل کنید.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InputField label="نام و نام خانوادگی" name="fullName" defaultValue={dashboard.user.fullName} minLength={2} required />
                  <InputField label="شماره موبایل" name="phone" defaultValue={dashboard.user.phone} type="tel" />
                  <InputField label="شماره تماس ضروری" name="emergencyPhone" defaultValue={dashboard.user.emergencyPhone} type="tel" />
                  <InputField label="کد ملی" name="nationalCode" defaultValue={dashboard.user.nationalCode} />
                  <label className="grid gap-1.5 text-sm font-bold text-brand">
                    <FieldLabel label="تاریخ تولد" />
                    <JalaliDateInput ariaLabel="تاریخ تولد" yearSelection className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15" max={new Date().toISOString().slice(0, 10)} name="birthDate" value={dashboard.user.birthDate} />
                  </label>
                  <InputField label="نشانی" name="address" defaultValue={dashboard.user.address} />
                  <InputField label="شماره همراه خریدار" name="buyerMobile" defaultValue={dashboard.user.buyerMobile} type="tel" />
                  <InputField label="تلفن ثابت" name="landline" defaultValue={dashboard.user.landline} type="tel" />
                  <InputField label="کد پستی" name="postalCode" defaultValue={dashboard.user.postalCode} />
                </div>
              </section>
              <section className="rounded-2xl border border-border bg-white p-5">
                <h2 className="font-black text-brand">اطلاعات حساب بانکی</h2>
                <p className="mt-1 text-sm text-muted">همهٔ فیلدهای این بخش اختیاری‌اند؛ برای حفظ امنیت فقط چهار رقم آخر کارت نمایش داده می‌شود.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InputField label="شماره شبا" name="bankIban" defaultValue={dashboard.user.bankIban} placeholder="IR…" />
                  <InputField label="شماره حساب" name="bankAccountNumber" defaultValue={dashboard.user.bankAccountNumber} />
                  <InputField label={dashboard.user.bankCardLast4 ? `شماره کارت (پایان با ${dashboard.user.bankCardLast4})` : "شماره کارت"} name="bankCardNumber" placeholder="فقط برای ثبت/به‌روزرسانی" inputMode="numeric" />
                </div>
              </section>
              <button className="min-h-11 rounded-xl bg-brand px-6 text-sm font-black text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={profileSaving} type="submit">{profileSaving ? "در حال ذخیره…" : "ذخیره اطلاعات"}</button>
            </form>
          </section>
        ) : null}
        {active === "trips" ? <section className="space-y-5"><header><h1 className="text-2xl font-black text-brand">سفرهای من</h1><p className="mt-1 text-sm text-muted">روی هر سفر بزنید تا وضعیت فعلی، مبلغ و شناسهٔ سفارش همان‌جا نمایش داده شود.</p></header><ErpFlightCheckoutRecovery /><ErpFlightOrders />{dashboard.cartItems.length > 0 && <section className="rounded-2xl border border-border bg-white p-4"><h2 className="font-bold text-brand">انتخاب‌های ناتمام در سبد سفر</h2><ul className="mt-2 space-y-2">{dashboard.cartItems.map((item) => <li className="flex flex-wrap justify-between gap-2 text-sm" key={item.id}><span>{item.titleSnapshot}</span>{item.priceAmount && item.currency && <strong>{formatCurrency(item.priceAmount, item.currency)}</strong>}</li>)}</ul><Link className="mt-3 inline-block font-bold text-brand underline" href="/cart/">ادامه خرید در سبد سفر</Link></section>}<OrderList onPay={startPayment} onRemove={removeOrder} orders={orders} payingOrderId={payingOrderId} /></section> : null}
        {active === "passengers" ? (
          <section className="space-y-5">
            <header>
              <h1 className="text-2xl font-black text-brand">لیست مسافران</h1>
              <p className="mt-1 text-sm text-muted">مسافران پرتکرار را یک بار ثبت کنید تا در خریدها سریع‌تر انتخاب شوند.</p>
            </header>
            <form className="grid gap-3 rounded-2xl border border-border bg-white p-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={addPassenger}>
              <InputField label="نام" name="firstName" required />
              <InputField label="نام خانوادگی" name="lastName" required />
              <InputField dir="ltr" label="نام انگلیسی" name="firstNameEn" status="با ثبت گذرنامه الزامی" />
              <InputField dir="ltr" label="نام خانوادگی انگلیسی" name="lastNameEn" status="با ثبت گذرنامه الزامی" />
              <InputField label="کد ملی" name="nationalCode" inputMode="numeric" status="کد ملی یا گذرنامه الزامی" />
              <InputField dir="ltr" label="شماره گذرنامه" name="passportNumber" status="کد ملی یا گذرنامه الزامی" />
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="تاریخ انقضای گذرنامه" status="با ثبت گذرنامه الزامی" /><JalaliDateInput ariaLabel="تاریخ انقضای گذرنامه" className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15" min={minimumPassportExpiryDate()} name="passportExpiryDate" value={null} /></label>
              <InputField dir="ltr" label="ایمیل" name="email" type="email" inputMode="email" />
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="جنسیت" required /><SiteSelect ariaLabel="جنسیت" id="passenger-gender" name="gender" options={[{ label: "انتخاب کنید", value: "" }, { label: "مرد", value: "male" }, { label: "زن", value: "female" }]} required /></label>
              <InputField label="سن" max={120} min={0} name="age" type="number" inputMode="numeric" />
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="تاریخ تولد" required /><JalaliDateInput ariaLabel="تاریخ تولد مسافر" yearSelection className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15" max={new Date().toISOString().slice(0, 10)} name="birthDate" required value={null} /></label>
              <InputField label="شماره موبایل" name="phone" type="tel" inputMode="tel" />
              <fieldset className="grid gap-3 rounded-2xl border border-brand/15 bg-surface-muted p-4 md:col-span-2 xl:col-span-3">
                <legend className="px-2 font-black text-brand">اطلاعات حیوان خانگی</legend>
                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-bold text-brand"><input name="hasPet" type="checkbox" /> همراه مسافر حیوان خانگی است</label>
                <div className="grid gap-3 md:grid-cols-3">
                  <InputField label="نام حیوان" name="petName" placeholder="اختیاری" />
                  <InputField label="نوع حیوان" name="petType" placeholder="مثلاً سگ یا گربه" status="در صورت همراه‌داشتن حیوان الزامی" />
                  <InputField label="وزن حیوان (کیلوگرم)" min={0.1} max={100} name="petWeightKg" status="در صورت همراه‌داشتن حیوان الزامی" type="number" inputMode="decimal" />
                </div>
                <p className="text-xs leading-6 text-muted">در صورت انتخاب حیوان خانگی، نوع و وزن آن را وارد کنید تا هماهنگی حمل انجام شود.</p>
              </fieldset>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold text-brand"><input name="isDefault" type="checkbox" /> مسافر پیش‌فرض</label>
              <button className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white md:col-span-2 xl:col-span-3" type="submit">افزودن مسافر</button>
            </form>
            <div className="flex gap-2"><input className="min-h-11 flex-1 rounded-xl border border-border bg-white px-3 text-sm" onChange={(event) => setPassengerSearch(event.target.value)} placeholder="جستجوی نام، نام انگلیسی، ایمیل، کد ملی یا شماره گذرنامه" value={passengerSearch} /><button className="rounded-xl border border-brand px-4 text-sm font-bold text-brand" onClick={() => void loadSection("passengers")} type="button">جستجو</button></div>
            {passengers.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {passengers.map((passenger) => {
                  const persianName = passenger.firstName && passenger.lastName ? `${passenger.firstName} ${passenger.lastName}` : passenger.fullName;
                  const englishName = [passenger.firstNameEn, passenger.lastNameEn].filter(Boolean).join(" ");
                  const gender = passenger.gender === "male" ? "مرد" : passenger.gender === "female" ? "زن" : "ثبت نشده";
                  return (
                    <li className="rounded-2xl border border-border bg-white p-4" key={passenger.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-brand">{persianName}</h3>
                          {englishName ? <p className="mt-1 text-sm text-muted" dir="ltr">{englishName}</p> : null}
                          <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                            <div><dt className="text-muted">جنسیت</dt><dd className="font-bold text-brand">{gender}</dd></div>
                            <div><dt className="text-muted">سن</dt><dd className="font-bold text-brand">{passenger.age ?? "ثبت نشده"}</dd></div>
                            <div><dt className="text-muted">ایمیل</dt><dd className="truncate font-bold text-brand" dir="ltr">{passenger.email ?? "ثبت نشده"}</dd></div>
                            <div><dt className="text-muted">گذرنامه</dt><dd className="font-bold text-brand" dir="ltr">{passenger.passportNumber ?? "ثبت نشده"}</dd></div>
                            <div><dt className="text-muted">انقضای گذرنامه</dt><dd className="font-bold text-brand">{passenger.passportExpiryDate ? persianDate(passenger.passportExpiryDate) : "ثبت نشده"}</dd></div>
                            <div><dt className="text-muted">شناسه</dt><dd className="font-bold text-brand">{passenger.nationalCode ?? "ثبت نشده"}</dd></div>
                            <div><dt className="text-muted">حیوان خانگی</dt><dd className="font-bold text-brand">{passenger.hasPet ? `${passenger.petName ? `${passenger.petName} · ` : ""}${passenger.petType ?? "نوع ثبت نشده"}${passenger.petWeightKg ? ` · ${passenger.petWeightKg} کیلوگرم` : ""}` : "ندارد"}</dd></div>
                          </dl>
                          {passenger.isDefault ? <span className="mt-3 inline-block rounded-full bg-brand/10 px-2 py-1 text-xs font-bold text-brand">مسافر پیش‌فرض</span> : null}
                        </div>
                        <button className="shrink-0 text-sm font-bold text-red-700" onClick={() => void deletePassenger(passenger.id)} type="button">حذف</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="مسافری ثبت نشده است" description="برای دسترسی سریع‌تر در زمان خرید، اولین مسافر را از فرم بالا اضافه کنید." />}
          </section>
        ) : null}        {active === "insurance" ? (
          <section className="space-y-5">
            <header><h1 className="text-2xl font-black text-brand">بیمه‌های من</h1><p className="mt-1 text-sm text-muted">بیمه‌نامه‌های سفر خود را ثبت کنید تا بازه اعتبار و پوشش آن‌ها همیشه در دسترس باشد.</p></header>
            <form className="grid gap-3 rounded-2xl border border-border bg-white p-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={addInsurance}>
              <InputField label="شرکت بیمه" name="provider" required />
              <InputField dir="ltr" label="شماره بیمه‌نامه" name="policyNumber" required />
              <InputField label="عنوان پوشش" name="coverageTitle" placeholder="مثلاً درمان و حوادث سفر" required />
              <InputField label="سقف پوشش" min={0} name="coverageAmount" type="number" inputMode="decimal" />
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="واحد پول" required /><SiteSelect ariaLabel="واحد پول" defaultValue="IRT" id="insurance-currency" name="currency" options={[{ label: "تومان", value: "IRT" }, { label: "دلار", value: "USD" }, { label: "یورو", value: "EUR" }]} required /></label>
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="وضعیت" required /><SiteSelect ariaLabel="وضعیت بیمه" defaultValue="active" id="insurance-status" name="status" options={[{ label: "فعال", value: "active" }, { label: "در انتظار صدور", value: "pending" }, { label: "منقضی‌شده", value: "expired" }, { label: "لغوشده", value: "cancelled" }]} required /></label>
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="شروع اعتبار" required /><JalaliDateInput ariaLabel="شروع اعتبار بیمه" className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal" name="startDate" required value={null} /></label>
              <label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="پایان اعتبار" required /><JalaliDateInput ariaLabel="پایان اعتبار بیمه" className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal" name="endDate" required value={null} /></label>
              <button className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white md:col-span-2 xl:col-span-3" type="submit">ثبت بیمه‌نامه</button>
            </form>
            {insurances.length ? <ul className="grid gap-3 md:grid-cols-2">{insurances.map((insurance) => <li className="rounded-2xl border border-border bg-white p-4" key={insurance.id}><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-black text-brand">{insuranceStatusLabels[insurance.status]}</span><h2 className="mt-3 font-black text-brand">{insurance.provider}</h2><p className="mt-1 text-sm text-muted" dir="ltr">{insurance.policyNumber}</p></div><button className="text-sm font-bold text-red-700" onClick={() => void deleteInsurance(insurance.id)} type="button">حذف</button></div><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted">پوشش</dt><dd className="font-bold text-brand">{insurance.coverageTitle}</dd></div><div><dt className="text-muted">سقف پوشش</dt><dd className="font-bold text-brand">{insurance.coverageAmount ? formatCurrency(insurance.coverageAmount, insurance.currency) : "ثبت نشده"}</dd></div><div><dt className="text-muted">شروع</dt><dd className="font-bold text-brand">{persianDate(insurance.startDate)}</dd></div><div><dt className="text-muted">پایان</dt><dd className="font-bold text-brand">{persianDate(insurance.endDate)}</dd></div></dl></li>)}</ul> : <EmptyState title="بیمه‌نامه‌ای ثبت نشده است" description="پس از دریافت بیمه سفر، اطلاعات آن را از فرم بالا ثبت کنید." />}
          </section>
        ) : null}
        {active === "favorites" ? <section><h1 className="text-2xl font-black text-brand">علاقه‌مندی‌ها</h1><p className="mt-1 text-sm text-muted">تورهای ذخیره‌شدهٔ شما.</p>{dashboard.savedTours.length ? <ul className="mt-5 grid gap-3 md:grid-cols-2">{dashboard.savedTours.map((tour) => <li className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4" key={tour.id}><div><Link className="font-black text-brand" href={`/tours/${tour.slug}/`}>{tour.title}</Link><p className="mt-1 text-sm text-muted">{tour.priceAmount && tour.currency ? formatCurrency(tour.priceAmount, tour.currency) : "استعلام قیمت"}</p></div><button className="text-sm font-bold text-red-700" onClick={() => void removeSavedTour(tour.tourId)} type="button">حذف</button></li>)}</ul> : <div className="mt-5"><EmptyState title="علاقه‌مندی ندارید" description="در صفحه هر تور، آن را به علاقه‌مندی‌ها اضافه کنید." /></div>}</section> : null}
        {active === "visa" ? <VisaApplicationsPanel /> : null}
        {active === "support" ? <section className="space-y-5"><header><h1 className="text-2xl font-black text-brand">درخواست پشتیبانی</h1><p className="mt-1 text-sm text-muted">موضوع و جزئیات درخواست خود را ثبت کنید؛ پاسخ در همین بخش قابل پیگیری است.</p></header><form className="space-y-3 rounded-2xl border border-border bg-white p-5" onSubmit={saveSupportRequest}><InputField label="موضوع" minLength={3} maxLength={160} name="subject" required /><label className="grid gap-1.5 text-sm font-bold text-brand"><FieldLabel label="پیام" required /><textarea className="min-h-28 rounded-xl border border-border p-3 font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" maxLength={4000} minLength={10} name="message" required /></label><button className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white" type="submit">ثبت درخواست</button></form>{supportRequests.length ? <ul className="space-y-3">{supportRequests.map((item) => <li className="rounded-2xl border border-border bg-white p-4" key={item.id}><div className="flex justify-between gap-3"><h3 className="font-black text-brand">{item.subject}</h3><span className="text-xs font-bold text-muted">{item.status === "open" ? "باز" : item.status === "closed" ? "بسته" : "در حال بررسی"}</span></div><div className="mt-3 space-y-2">{item.messages?.length ? item.messages.map((entry) => <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-7 ${entry.senderType === "customer" ? "mr-auto bg-brand text-white" : "ml-auto border border-pink-200 bg-pink-50 text-brand"}`} key={entry.id}><strong className="mb-1 block text-[11px]">{entry.senderType === "admin" ? "پشتیبان" : entry.senderType === "bot" ? "پاسخ خودکار" : "شما"}</strong><p className="whitespace-pre-line">{entry.body}</p></div>) : <p className="whitespace-pre-line text-sm leading-7 text-muted">{item.message}</p>}</div></li>)}</ul> : <EmptyState title="درخواست پشتیبانی ندارید" description="برای پیگیری خرید یا دریافت راهنمایی، یک درخواست جدید ثبت کنید." />}</section> : null}
        {active === "alerts" ? <section><h1 className="text-2xl font-black text-brand">اعلان‌ها</h1><p className="mt-1 text-sm text-muted">درخواست‌های اطلاع‌رسانیِ موجودی بلیت شما.</p>{alerts.length ? <ul className="mt-5 space-y-3">{alerts.map((alert) => <li className="rounded-2xl border border-border bg-white p-4" key={alert.id}><strong className="text-brand">{alert.origin} ← {alert.destination}</strong><p className="mt-1 text-sm text-muted">{alert.serviceType} · {persianDate(alert.departureDate)} · {alert.isActive ? "فعال" : "غیرفعال"}</p></li>)}</ul> : <div className="mt-5"><EmptyState title="اعلان فعالی ندارید" description="از صفحه نتایج بلیت، گزینه اطلاع از موجودی را فعال کنید." /></div>}</section> : null}
        {active === "wallet" ? <section className="space-y-5"><h1 className="text-2xl font-black text-brand">موجودی و اعتبار من</h1><div className={`grid gap-4 ${dashboard.agency ? "md:grid-cols-2" : ""}`}><div className="rounded-2xl bg-brand p-6 text-white"><p className="text-sm text-white/75">موجودی کیف پول</p><strong className="mt-2 block text-3xl font-black">{formatCurrency(dashboard.wallet.availableCredit, dashboard.wallet.currency)}</strong><p className="mt-3 text-sm text-white/75">موجودی فقط پس از تأیید نهایی درگاه پرداخت به کیف پول اضافه می‌شود.</p></div>{dashboard.agency ? <div className="rounded-2xl border border-pink-200 bg-pink-50 p-6 text-brand"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">اعتبار آژانسی قابل استفاده</p><span className={`rounded-full px-2.5 py-1 text-xs font-black ${dashboard.agency.status === "approved" ? "bg-emerald-100 text-emerald-800" : dashboard.agency.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{dashboard.agency.status === "approved" ? "تأییدشده" : dashboard.agency.status === "rejected" ? "ردشده" : "در انتظار تأیید پشتیبان"}</span></div><strong className="mt-2 block text-3xl font-black">{formatCurrency(dashboard.agency.availableCredit, dashboard.agency.currency)}</strong><dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">سقف اعتبار</dt><dd className="mt-1 font-black">{formatCurrency(dashboard.agency.creditLimit, dashboard.agency.currency)}</dd></div><div><dt className="text-muted">مصرف‌شده و رزروشده</dt><dd className="mt-1 font-black">{formatCurrency(Number(dashboard.agency.creditUsed) + Number(dashboard.agency.creditReserved), dashboard.agency.currency)}</dd></div></dl>{dashboard.agency.reviewNote ? <p className="mt-3 rounded-xl bg-white/75 p-3 text-xs leading-6">یادداشت پشتیبان: {dashboard.agency.reviewNote}</p> : null}</div> : null}</div>{dashboard.agency ? <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-black text-brand">مشخصات آژانس</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-muted">کانتر فروش</dt><dd className="font-bold text-brand">{dashboard.user.fullName}</dd></div><div><dt className="text-muted">نام حقوقی</dt><dd className="font-bold text-brand">{dashboard.agency.legalName}</dd></div><div><dt className="text-muted">شماره ثبت</dt><dd className="font-bold text-brand">{dashboard.agency.registrationNumber}</dd></div><div><dt className="text-muted">شناسه ملی</dt><dd className="font-bold text-brand">{dashboard.agency.nationalId || "ثبت نشده"}</dd></div><div><dt className="text-muted">کد اقتصادی</dt><dd className="font-bold text-brand">{dashboard.agency.economicCode || "ثبت نشده"}</dd></div><div><dt className="text-muted">شماره مجوز</dt><dd className="font-bold text-brand">{dashboard.agency.licenseNumber}</dd></div><div><dt className="text-muted">مدیرعامل</dt><dd className="font-bold text-brand">{dashboard.agency.managerName}</dd></div><div><dt className="text-muted">شماره موبایل مدیرعامل</dt><dd className="font-bold text-brand" dir="ltr">{dashboard.agency.phone}</dd></div><div><dt className="text-muted">شهر</dt><dd className="font-bold text-brand">{dashboard.agency.province}، {dashboard.agency.city}</dd></div></dl></section> : null}<WalletTopUpPanel />{onlineSalesEnabled ? <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-black text-brand">سبد خرید</h2><p className="mt-2 text-sm text-muted">{dashboard.cartItems.length} مورد در سبد شما قرار دارد.</p><strong className="mt-2 block text-xl text-brand">{formatCurrency(cartTotal, dashboard.wallet.currency)}</strong><Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-black text-white" href="/cart/">مشاهده سبد خرید و پرداخت</Link></section> : null}</section> : null}
      </main>
    </div>
  );
}

function OrderList({ orders, onRemove, onPay, payingOrderId }: { orders: Order[]; onRemove: (order: Order) => void; onPay: (order: Order) => void; payingOrderId: number | null }) {
  const [renderedAt] = useState(() => Date.now());
  if (!orders.length) return <EmptyState title="رزرو یا سفارش مستقیمی ثبت نشده است" description="رزروها و سفارش‌های ثبت‌شدهٔ جهان باستان با وضعیت فعلی در این قسمت نمایش داده می‌شوند." />;

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const isAwaitingSupportConfirmation = order.source === "booking" && order.status === "paid" && !order.ticketsIssued;
        const canPay = order.source === "booking" && order.status === "approved" && Number(order.amount) > 0 && (!order.paymentExpiresAt || new Date(order.paymentExpiresAt).getTime() > renderedAt);
        const statusLabel = isAwaitingSupportConfirmation ? "پرداخت ثبت شد؛ در انتظار تأیید پشتیبان" : orderStatusLabels[order.status] ?? order.status;
        const serviceItems = order.serviceItems ?? [];
        return (
          <li className="overflow-hidden rounded-2xl border border-border bg-white transition hover:border-brand/40" key={`${order.source}-${order.id}`}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-5 text-right">
                <div className="min-w-0">
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-black text-brand">{order.source === "booking" ? "رزرو سفر" : "پرداخت"}</span>
                  <h2 className="mt-3 truncate text-xl font-black text-brand sm:text-2xl">{order.title || "رزرو سفر"}</h2>
                  {serviceItems[0]?.details ? <p className="mt-1 line-clamp-1 text-sm text-muted">{serviceItems[0].details}</p> : null}
                  <p className="mt-2 text-xs font-bold text-muted" dir="ltr">ID: {order.orderNumber}</p>
                </div>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-xl text-brand transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="border-t border-border bg-surface-muted/70 p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-white p-3"><span className="block text-xs text-muted">وضعیت فعلی</span><strong className="mt-1 block text-sm text-brand">{statusLabel}</strong></div>
                  <div className="rounded-xl bg-white p-3"><span className="block text-xs text-muted">مبلغ نهایی</span><strong className="mt-1 block text-sm text-brand">{formatCurrency(order.amount, order.currency)}</strong></div>
                  <div className="rounded-xl bg-white p-3"><span className="block text-xs text-muted">زمان ثبت درخواست</span><time className="mt-1 block text-sm font-black text-brand">{formatPersianDateTime(order.createdAt)}</time></div>
                  <div className="rounded-xl bg-white p-3"><span className="block text-xs text-muted">مسافران و صدور</span><strong className="mt-1 block text-sm text-brand">{order.passengerCount.toLocaleString("fa-IR")} مسافر{order.ticketsIssued ? " · بلیت صادر شده" : ""}</strong></div>
                </div>

                {serviceItems.length ? <section className="mt-4 rounded-xl border border-brand/10 bg-white p-4"><h3 className="text-sm font-black text-brand">جزئیات خدمات انتخاب‌شده</h3><ul className="mt-3 grid gap-2">{serviceItems.map((item, index) => <li className="rounded-lg bg-surface-muted px-3 py-2 text-sm" key={`${item.title}-${index}`}><strong className="text-brand">{item.title}</strong>{item.details ? <span className="mr-2 text-muted">· {item.details}</span> : null}</li>)}</ul></section> : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-bold text-muted">{isAwaitingSupportConfirmation ? <p>پرداخت ثبت شده است؛ پس از تأیید پشتیبان، بلیت صادر می‌شود.</p> : <><p>شناسهٔ پیگیری: <span dir="ltr">{order.orderNumber}</span></p>{order.updatedAt ? <p className="mt-1 text-xs">آخرین تغییر وضعیت: {formatPersianDateTime(order.updatedAt)}</p> : null}{order.paymentExpiresAt && order.status === "approved" ? <p className="mt-1 text-xs text-amber-800">مهلت پرداخت: {formatPersianDateTime(order.paymentExpiresAt)}</p> : null}</>}</div>
                  {canPay ? <button className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={payingOrderId === order.id} onClick={() => void onPay(order)} type="button">{payingOrderId === order.id ? "در حال ورود به درگاه…" : "ورود به لینک پرداخت"}</button> : null}<button className="min-h-10 rounded-xl border border-red-200 px-4 text-sm font-black text-red-700 transition hover:bg-red-50" onClick={() => void onRemove(order)} type="button">حذف از سفرهای من</button>
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
