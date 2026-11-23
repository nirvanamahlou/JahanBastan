"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DepartureFilters } from "./departure-filters";
import { SiteSelect } from "@/components/ui/site-select";

import { adminClientFetch } from "@/lib/admin-client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";

const GENERIC_TYPES = [
  ["countries", "کشورها"],
  ["destinations", "مقاصد"],
  ["articles", "مقالات"],
  ["faqs", "سؤالات متداول"],
  ["services", "خدمات سفر"],
  ["tours", "تورهای گردشگری"],
] as const;

type GenericType = (typeof GENERIC_TYPES)[number][0];
type TourOption = {
  id: number;
  title: string;
  isCombinedStay?: boolean;
  departures?: { id: number; label: string; departureDate: string; nights: number | null }[];
};

type CombinationPreview = {
  row: number;
  title: string;
  departureDate: string;
  hotels: { name: string; nights: number; service: string | null }[];
  prices: Record<string, string | number | null>;
};
const combinedPriceLabels = [
  ["double", "دوتخته"], ["single", "تک‌تخته"], ["child_with_bed", "کودک با تخت"],
  ["child_without_bed", "کودک بدون تخت"], ["infant", "نوزاد"],
  ["infant_supplement", "بخش تومانی قیمت نوزاد"],
  ["regular_flight", "پرواز بزرگسال"], ["child_with_bed_flight", "پرواز کودک با تخت"],
] as const;

type Notice = { tone: "success" | "error" | "info" | "warning"; text: string } | null;

type ImportWarning = { row: number; message: string };

class ImportSessionExpiredError extends Error {
  constructor() {
    super("ورود شما به پنل دیگر معتبر نیست. دوباره وارد شوید، سپس در همین صفحه پیش‌نمایش یا ثبت را بزنید. فایل انتخاب‌شده حفظ می‌شود.");
  }
}

async function importClientFetch(path: string, init: RequestInit = {}) {
  const response = await adminClientFetch(path, init);
  if (response.status === 401) throw new ImportSessionExpiredError();
  return response;
}

async function checkImportSession() {
  const response = await importClientFetch("/auth/me", { cache: "no-store" });
  if (!response.ok) throw new Error("بررسی وضعیت ورود ناموفق بود؛ دوباره تلاش کنید.");
}

function errorMessage(detail: unknown, fallback: string) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) return detail.map(item => `${item.loc?.join(" ← ") ?? "ورودی"}: ${item.msg ?? "مقدار نامعتبر"}`).join("؛ ");
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message === "Fix the listed workbook rows and try again."
        ? "فایل نیاز به اصلاح دارد؛ خطاهای ردیف‌ها را پایین ببینید."
        : `${message}${"reference" in detail ? ` کد پیگیری: ${String(detail.reference)}` : ""}`;
    }
  }
  return fallback;
}

function ErrorList({ detail }: { detail: unknown }) {
  if (!detail || typeof detail !== "object" || !("errors" in detail)) return null;
  const errors = (detail as { errors?: { row: number; message: string }[] }).errors ?? [];
  return <ul className="mt-2 list-disc space-y-1 pr-5">{errors.map((item) => <li key={`${item.row}-${item.message}`}>ردیف {item.row}: {item.message}</li>)}</ul>;
}

export function DataTransferPanel() {
  const router = useRouter();
  const hotelInput = useRef<HTMLInputElement>(null);
  const priceInput = useRef<HTMLInputElement>(null);
  const genericInput = useRef<HTMLInputElement>(null);
  const [cities, setCities] = useState<{ id: number; city: string; title: string; country: string }[]>([]);
  const [cityId, setCityId] = useState("");
  const [cityLoadError, setCityLoadError] = useState(false);

  useEffect(() => {
    importClientFetch("/admin/excel/hotels/cities", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setCities)
      .catch(() => setCityLoadError(true));
  }, []);

  const [tours, setTours] = useState<TourOption[]>([]);
  const [date, setDate] = useState("");
  const [targetDeparture, setTargetDeparture] = useState("");
  const [tourId, setTourId] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const departures = tours.find(tour => String(tour.id) === tourId)?.departures ?? [];
  const hasPackage = departures.some(item => String(item.id) === targetDeparture && item.departureDate === date);
  const priceParams = new URLSearchParams();
  if (defaultCurrency) priceParams.set("defaultCurrency", defaultCurrency);
  if (targetDeparture) priceParams.set("departureId", targetDeparture);
  const priceImportPath = `/admin/excel/tours/${tourId}/prices/import${priceParams.size ? "?" + priceParams : ""}`;

  const [genericType, setGenericType] = useState<GenericType>("destinations");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [warnings, setWarnings] = useState<ImportWarning[]>([]);
  const [combinations, setCombinations] = useState<CombinationPreview[]>([]);
  const [needsLogin, setNeedsLogin] = useState(false);

  function clearReport() {
    setNotice(null); setDetail(null); setWarnings([]); setCombinations([]);
  }

  const showError = useCallback((error: unknown, fallback: string) => {
    setNeedsLogin(error instanceof ImportSessionExpiredError);
    setNotice({ tone: "error", text: error instanceof TypeError ? "ارتباط با سرور قطع شد؛ وضعیت ثبت مشخص نیست. پیش از ثبت دوباره، قیمت‌های تور را بررسی کنید." : error instanceof Error ? error.message : fallback });
  }, []);

  useEffect(() => {
    importClientFetch(`/admin/excel/tour-options`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((items: TourOption[]) => setTours(items))
      .catch((error: unknown) => showError(error, "دریافت فهرست تورها ناموفق بود."));
  }, [showError]);

  useEffect(() => {
    if (!needsLogin) return;
    let active = true;
    const checkLoginOnReturn = async () => {
      try {
        const response = await importClientFetch("/admin/excel/tour-options", { cache: "no-store" });
        if (!response.ok) return;
        const items: TourOption[] = await response.json();
        if (!active) return;
        setTours(items);
        setNeedsLogin(false);
        setNotice({ tone: "info", text: "ورود تأیید شد. فایل و تور انتخاب‌شده حفظ شده‌اند؛ اکنون پیش‌نمایش یا ثبت را بزنید." });
      } catch {
        // Keep the login guidance until the session is valid; never replay an import.
      }
    };
    window.addEventListener("focus", checkLoginOnReturn);
    return () => {
      active = false;
      window.removeEventListener("focus", checkLoginOnReturn);
    };
  }, [needsLogin]);

  async function download(path: string) {
    try {
      await checkImportSession();
      setNeedsLogin(false);
      const link = document.createElement("a");
      link.href = `/admin-gateway${path}`;
      link.download = "";
      document.body.append(link);
      link.click();
      link.remove();
    } catch (error) {
      showError(error, "دانلود قالب ناموفق بود.");
    }
  }

  async function upload(path: string, file: File | undefined, mode: "preview" | "commit", key: string) {
    if (!file) {
      setNotice({ tone: "error", text: "ابتدا فایل Excel با پسوند .xlsx را انتخاب کنید." });
      return;
    }
    setBusy(key);
    setNotice(null);
    setDetail(null);
    setWarnings([]);
    setCombinations([]);
    const body = new FormData();
    body.append("file", file);
    try {
      await checkImportSession();
      setNeedsLogin(false);
      const separator = path.includes("?") ? "&" : "?";
      const response = await importClientFetch(`${path}${separator}mode=${mode}`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const responseDetail = payload?.detail ?? payload ?? { message: response.status === 413 ? "حجم فایل از حد مجاز بیشتر است؛ فایل کوچک‌تر انتخاب کنید." : [502, 503, 504].includes(response.status) ? "ارتباط با سرویس ورود داده برقرار نشد یا زمان پردازش تمام شد؛ ابتدا پیش‌نمایش بگیرید و سپس نتیجهٔ ثبت را بررسی کنید." : `دریافت پاسخ ورود داده ناموفق بود (کد ${response.status}).` };
        setDetail(responseDetail);
        throw new Error(errorMessage(responseDetail, "اعتبارسنجی فایل ناموفق بود."));
      }
      const count = payload.rows ?? payload.replaced ?? payload.created ?? 0;
      const syncedRoomTypes = Number(payload.syncedRoomTypes ?? 0);
      const retiredPrices = Number(payload.retiredPrices ?? 0);
      const importWarnings: ImportWarning[] = Array.isArray(payload.warnings) ? payload.warnings : [];
      setWarnings(importWarnings);
      setCombinations(Array.isArray(payload.combinations) ? payload.combinations : []);
      setNotice({
        tone: importWarnings.length || retiredPrices ? "warning" : "success",
        text: (mode === "preview"
          ? importWarnings.length
            ? `${count} ردیف آماده ثبت است؛ هشدارهای زیر را پیش از ثبت بررسی کنید.`
            : `فایل معتبر است؛ ${count} ردیف آماده ثبت است. هنوز هیچ قیمتی ذخیره نشده؛ دکمهٔ ثبت را بزنید.`
          : `${count} ردیف با موفقیت ثبت شد.${key === "price-commit" && syncedRoomTypes ? ` ${syncedRoomTypes} نوع اتاق نیز به هتل‌ها منتقل شد.` : ""}`) + (retiredPrices ? ` ${retiredPrices} قیمت قبلی این تاریخ‌ها که در فایل نیست، ${mode === "preview" ? "غیرفعال خواهد شد" : "غیرفعال شد"}.` : ""),
      });
      if (typeof payload.packages === "number") {
        setNotice({
          tone: importWarnings.length ? "warning" : "success",
          text: `${payload.packages} ترکیب از ${count} ردیف ${mode === "preview" ? "آماده ثبت است" : "ثبت شد"}. ${payload.createdPackages ?? 0} ترکیب جدید و ${payload.createdDepartures ?? 0} تاریخ جدید ${mode === "preview" ? "ساخته می‌شود" : "ساخته شد"}. ترتیب هتل‌ها، تعداد شب‌ها و قیمت تاریخ‌های دیگر حفظ می‌شود.`,
        });
      }
      if (mode === "commit") {
        if (Array.isArray(payload.departureDates)) setNotice(current => current ? { ...current, text: `${current.text} تاریخ‌های ثبت‌شده: ${payload.departureDates.map((day: string) => formatPersianDate(day)).join("، ")}.` } : current);
        router.refresh();
      }
    } catch (error) {
      showError(error, "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy("");
    }
  }

  async function uploadGeneric() {
    setCombinations([]);
    const file = genericInput.current?.files?.[0];
    if (!file) return setNotice({ tone: "error", text: "ابتدا فایل Excel را انتخاب کنید." });
    setBusy("generic");
    setNotice(null);
    setDetail(null);
    setWarnings([]);
    const body = new FormData();
    body.append("file", file);
    try {
      await checkImportSession();
      setNeedsLogin(false);
      const response = await importClientFetch(`/admin/data-transfer/import?type=${genericType}`, { method: "POST", credentials: "include", body });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const responseDetail = payload?.detail ?? payload ?? { message: response.status === 413 ? "حجم فایل از حد مجاز بیشتر است؛ فایل کوچک‌تر انتخاب کنید." : [502, 503, 504].includes(response.status) ? "ارتباط با سرویس ورود داده برقرار نشد یا زمان پردازش تمام شد؛ ابتدا پیش‌نمایش بگیرید و سپس نتیجهٔ ثبت را بررسی کنید." : `دریافت پاسخ ورود داده ناموفق بود (کد ${response.status}).` };
        setDetail(responseDetail);
        throw new Error(errorMessage(responseDetail, "ورود فایل ناموفق بود."));
      }
      setNotice({ tone: "success", text: `${payload.created} مورد ثبت شد.` });
      router.refresh();
    } catch (error) {
      showError(error, "ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy("");
    }
  }

  const card = "rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7";
  const field = "min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-brand";
  const primary = "min-h-11 rounded-xl bg-brand px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45";
  const secondary = "min-h-11 rounded-xl border border-brand px-5 text-sm font-bold text-brand disabled:opacity-45";

  return (
    <section className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <div>
        <p className="text-sm font-bold text-brand/65">ورود و همگام‌سازی Excel</p>
        <h1 className="mt-1 text-2xl font-black text-brand sm:text-3xl">داده‌های هتل و قیمت تاریخ‌محور تور</h1>
      </div>

      <article className={card}>
        <p className="text-xs font-black text-brand/60">مرحله اول</p>
        <h2 className="mt-1 text-xl font-black text-brand">الصاق اطلاعات هتل‌ها با Excel</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className={secondary} onClick={() => download("/admin/excel/hotels/template")} type="button">دانلود قالب اطلاعات هتل</button>
          <input ref={hotelInput} className={field} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={secondary} disabled={Boolean(busy)} onClick={() => upload("/admin/excel/hotels/import", hotelInput.current?.files?.[0], "preview", "hotel-preview")} type="button">{busy === "hotel-preview" ? "در حال بررسی…" : "پیش‌نمایش و اعتبارسنجی"}</button>
          <button className={primary} disabled={Boolean(busy)} onClick={() => upload("/admin/excel/hotels/import", hotelInput.current?.files?.[0], "commit", "hotel-commit")} type="button">{busy === "hotel-commit" ? "در حال ثبت…" : "ثبت و به‌روزرسانی هتل‌ها"}</button>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-brand">شهر هتل‌ها
              <SiteSelect ariaLabel="انتخاب شهر هتل‌ها" id="excel-hotel-city" className={field} value={cityId} onValueChange={setCityId} searchable placeholder="انتخاب شهر" options={cities.map((city) => ({ value: String(city.id), label: [city.city || city.title, city.country].filter(Boolean).join(" — ") }))} />
            </label>
            <button className={secondary} disabled={!cityId || Boolean(busy)} onClick={() => download("/admin/excel/hotels/city-template?destinationId=" + cityId)} type="button">دانلود اکسل هتل‌های شهر</button>
          </div>
          {cityLoadError ? <p role="alert" className="mt-2 text-sm text-red-700">دریافت فهرست شهرها ناموفق بود. صفحه را دوباره باز کنید.</p> : null}
        </div>
      </article>

      <article className={card}>
        <p className="text-xs font-black text-brand/60">مرحله دوم</p>
        <h2 className="mt-1 text-xl font-black text-brand">الصاق جدول قیمت و تاریخ‌های تور</h2>
        <p className="mt-2 text-sm leading-7 text-foreground/70">
          تور، تاریخ برگزاری و مدت اقامت را انتخاب کنید. تاریخ ردیف‌های اکسل باید با تاریخ انتخاب‌شده یکسان باشد.
        </p>
        {tours.find((tour) => String(tour.id) === tourId)?.isCombinedStay ? <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-7 text-violet-900">
          تور ترکیبی: هر دو ردیف یک ترکیب هتل هستند؛ قیمت‌ها می‌توانند ادغام‌شده یا در دو ردیف تکرار شده باشند. قالب دو ردیفی تأمین‌کننده با ستون‌های hotel_id، departure_date، hotel_name و قیمت‌های ادغام‌شده پذیرفته می‌شود؛ نام‌های مخفف شناخته‌شده تطبیق داده می‌شوند. برای ترکیب جدید، تعداد شب از الگوی یکسان اقامت‌های همین تور خوانده می‌شود. ترکیب‌های قبلی بدون تغییر اقامت حفظ می‌شوند. هدرهای فارسی و انگلیسی، تاریخ شمسی و میلادی و مقدار خالی یا null پشتیبانی می‌شوند. اگر ستون flight child w bed خالی باشد، نرخ flight per person برای پرواز کودک با تخت استفاده می‌شود؛ صفر صریح یعنی بدون هزینه پرواز.
        </p> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-brand">تور
            <SiteSelect ariaLabel="انتخاب تور" id="excel-tour" className={field} value={tourId} onValueChange={(id) => { setTourId(id); setDate(""); setTargetDeparture(""); clearReport(); }} searchable placeholder="انتخاب تور" options={tours.map((tour) => ({ value: String(tour.id), label: tour.title }))} />
          </label>
          <button className={`${secondary} self-end`} disabled={!tourId} onClick={() => download(`/admin/excel/tour-prices/template?tourId=${tourId}`)} type="button">
            {tours.find((tour) => String(tour.id) === tourId)?.isCombinedStay ? "دانلود قالب ترکیبی این تور" : "دانلود قالب خالی قیمت تور"}
          </button>
        </div>
        <DepartureFilters items={departures} date={date} id={targetDeparture} disabled={Boolean(busy)}
          onDate={day => { setDate(day); setTargetDeparture(""); clearReport(); }}
          onStay={id => { setTargetDeparture(id); clearReport(); }} />
        {tourId && !departures.length && <p className="text-sm text-muted">ابتدا تاریخ و مدت اقامت را در ویرایش تور ثبت کنید.</p>}
        <button className={`${secondary} mt-3`} disabled={!tourId} onClick={() => download(`/admin/excel/tour-prices/template?tourId=${tourId}&combined=true`)} type="button">دانلود قالب ترکیبی مشابه فایل تأمین‌کننده</button>
        <div className="mt-4">
          <label className="grid gap-2 text-sm font-bold">ارز نرخ هتل و کودک بدون تخت برای اعداد بدون علامت<select className={field} value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value)}><option value="">طبق فایل (پیش‌فرض تومان)</option><option value="USD">دلار</option><option value="EUR">یورو</option><option value="IRT">تومان</option></select><span className="text-xs text-muted">نرخ پرواز و نوزاد همچنان تومان است؛ علامت ارز داخل سلول اولویت دارد.</span></label>
          <input ref={priceInput} className={field} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={secondary} disabled={!hasPackage || Boolean(busy)} onClick={() => upload(priceImportPath, priceInput.current?.files?.[0], "preview", "price-preview")} type="button">{busy === "price-preview" ? "در حال بررسی…" : "پیش‌نمایش تاریخ‌ها و قیمت‌ها"}</button>
          <button className={primary} disabled={!hasPackage || Boolean(busy)} onClick={() => upload(priceImportPath, priceInput.current?.files?.[0], "commit", "price-commit")} type="button">{busy === "price-commit" ? "در حال ثبت…" : "ثبت تاریخ‌ها و قیمت‌های این تور"}</button>
        </div>
      </article>

      {notice ? <div className={`rounded-2xl border p-4 text-sm font-bold ${notice.tone === "error" ? "border-red-300 bg-red-50 text-red-800" : notice.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`} role="status" aria-live="polite" aria-atomic="true">{notice.text}{needsLogin ? <Link className="mt-3 flex min-h-11 w-fit items-center rounded-xl border border-current px-4 underline underline-offset-4" href="/admin/login/" target="_blank" rel="noopener noreferrer" prefetch={false}>ورود مجدد در تب جدید</Link> : null}<ErrorList detail={detail} />{warnings.length ? <ul className="mt-2 list-disc space-y-1 pr-5">{warnings.map((warning, index) => <li key={`${warning.row}-${index}`}>ردیف {warning.row}: {warning.message}</li>)}</ul> : null}</div> : null}

      {combinations.length ? <section className={card} aria-label="نتیجه ورود ترکیب‌ها">
        <h2 className="text-xl font-black text-brand">ترکیب‌ها و قیمت‌های خوانده‌شده</h2>
        <div className="mt-4 space-y-5">{combinations.map((combination) => <article className="rounded-2xl border border-border p-4" key={`${combination.row}-${combination.departureDate}`}>
          <h3 className="font-black text-brand">{combination.title} · {formatPersianDate(combination.departureDate)}</h3>
          <p className="mt-2 text-sm leading-7">{combination.hotels.map((hotel) => `${hotel.name} (${hotel.nights} شب${hotel.service ? ` · ${hotel.service}` : ""})`).join(" + ")}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{combinedPriceLabels.map(([field, label]) => {
            const amount = combination.prices[`${field}_price`];
            return <div className="rounded-xl bg-surface-muted p-3 text-sm" key={field}><dt>{label}</dt><dd className="mt-1 font-bold">{amount != null ? formatCurrency(amount, String(combination.prices[`${field}_currency`])) : (field === "child_with_bed_flight" || field === "regular_flight") ? "بدون مبلغ اضافه" : "ناموجود"}</dd></div>;
          })}</dl>
        </article>)}</div>
      </section> : null}

      <details className={card}>
        <summary className="cursor-pointer text-base font-black text-brand">ورود و خروجی عمومی محتوا (سازگاری قبلی)</summary>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <select className={field} value={genericType} onChange={(event) => setGenericType(event.target.value as GenericType)}>{GENERIC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input ref={genericInput} className={field} type="file" accept=".xlsx" />
          <button className={secondary} onClick={() => download(`/admin/data-transfer/template?type=${genericType}`)} type="button">دانلود قالب عمومی</button>
          <button className={primary} disabled={Boolean(busy)} onClick={uploadGeneric} type="button">ورود فایل عمومی</button>
        </div>
      </details>
    </section>
  );
}
