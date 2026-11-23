"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { DepartureFilters } from "./departure-filters";
import { adminClientFetch } from "@/lib/admin-client";
import { formatPersianDate } from "@/lib/persian-date";

type Target = "tour" | "hotels" | "city" | "ticket";
type Direction = "increase" | "decrease";
type Calculation = "percentage" | "fixed";
type TourRateGroup = "" | "hotel" | "flight";
type AdjustmentCurrency = "" | "IRT" | "EUR" | "USD";
type Option = { id: number; label: string; subtitle: string | null };
type DepartureOption = Option & { nights: number | null; departureDate: string | null; returnDate: string | null };
type Options = { tours: Option[]; hotels: Option[]; cities: string[]; tickets: Option[] };
type Preview = { target: Target; direction: Direction; calculation: Calculation; value: string; selectedItems: number; eligibleRates: number; skippedUnpriced: number; skippedForeignCurrency: number; blockedRates: number; beforeTotalToman: string; afterTotalToman: string; canApply: boolean };

const targetLabels: Record<Target, string> = { tour: "یک تور مشخص", hotels: "هتل‌های انتخابی", city: "هتل‌های یک شهر", ticket: "یک بلیت مشخص" };
const tourFieldOptions: Record<Exclude<TourRateGroup, "">, { value: string; label: string }[]> = {
  hotel: [
    { value: "extra", label: "تخت اضافه (اکسترا)" },
    { value: "double", label: "دو تخته" }, { value: "single", label: "یک تخته" },
    { value: "child_with_bed", label: "کودک با تخت" }, { value: "child_without_bed", label: "کودک بدون تخت" },
    { value: "infant", label: "نوزاد" },
  ],
  flight: [
    { value: "extra_flight", label: "تخت اضافه (اکسترا)" },
    { value: "double_flight", label: "دو تخته" },
    { value: "single_flight", label: "سینگل (یک تخته)" },
    { value: "child_with_bed_flight", label: "کودک با تخت" },
    { value: "child_without_bed", label: "کودک بدون تخت" },
    { value: "infant", label: "نوزاد" },
  ],
};
const fieldOptions: Record<Target, { value: string; label: string }[]> = {
  tour: [],
  hotels: [{ value: "hotel_base", label: "قیمت پایه" }, { value: "hotel_child_with_bed", label: "کودک با تخت" }, { value: "hotel_child_without_bed", label: "کودک بدون تخت" }, { value: "hotel_infant", label: "نوزاد" }],
  city: [{ value: "hotel_base", label: "قیمت پایه" }, { value: "hotel_child_with_bed", label: "کودک با تخت" }, { value: "hotel_child_without_bed", label: "کودک بدون تخت" }, { value: "hotel_infant", label: "نوزاد" }],
  ticket: [{ value: "ticket_base", label: "قیمت بلیت" }],
};
const defaults: Record<Target, string[]> = { tour: [], hotels: ["hotel_base"], city: ["hotel_base"], ticket: ["ticket_base"] };
function normalizeAdjustmentAmount(input: string): string {
  return input.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬,\s]/g, "").replace(/٫/g, ".");
}

function formatAdjustmentAmount(input: string): string {
  const [whole, fraction] = input.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    + (fraction === undefined ? "" : `.${fraction}`);
}

const fmt = (value: string | number) => Number(value).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
const departureLabel = (item: DepartureOption) => [item.label, item.nights ? item.nights.toLocaleString("fa-IR") + " شب" : null, item.departureDate ? `رفت ${formatPersianDate(item.departureDate)}` : null, item.returnDate ? `برگشت ${formatPersianDate(item.returnDate)}` : null].filter(Boolean).join(" · ");

export function BulkPricingManagerV2() {
  const [options, setOptions] = useState<Options | null>(null);
  const [target, setTarget] = useState<Target>("tour");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [date, setDate] = useState("");
  const [departureId, setDepartureId] = useState<number | null>(null);
  const [departureOptions, setDepartureOptions] = useState<{ tourId: number; items: DepartureOption[] } | null>(null);
  const [departureError, setDepartureError] = useState("");
  const [departureRetry, setDepartureRetry] = useState(0);
  const [city, setCity] = useState("");
  const [fields, setFields] = useState<string[]>(defaults.tour);
  const [tourRateGroup, setTourRateGroup] = useState<TourRateGroup>("");
  const [currency, setCurrency] = useState<AdjustmentCurrency>("");
  const [direction, setDirection] = useState<Direction>("increase");
  const [calculation, setCalculation] = useState<Calculation>("percentage");
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminClientFetch("/admin/pricing/v2/options", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail ?? "دریافت گزینه‌های قیمت‌گذاری ناموفق بود.");
      if (active) setOptions(payload);
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "دریافت گزینه‌ها ناموفق بود.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const tourId = target === "tour" ? selectedIds[0] : undefined;
  useEffect(() => {
    if (!tourId) return;
    let active = true;
    async function loadDepartures() {
      const departures: DepartureOption[] = [];
      for (let offset = 0; active; offset += 100) {
        const response = await adminClientFetch(`/admin/pricing/v2/tours/${tourId}/departures?limit=100&offset=${offset}`, { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.detail ?? "دریافت تاریخ‌های برگزاری ناموفق بود.");
        departures.push(...result);
        if (result.length < 100) break;
      }
      if (active) setDepartureOptions({ tourId: tourId!, items: departures });
    }
    void loadDepartures().catch((reason) => {
      if (active) setDepartureError(reason instanceof Error ? reason.message : "دریافت تاریخ‌های برگزاری ناموفق بود.");
    });
    return () => { active = false; };
  }, [tourId, departureRetry]);

  const departures = departureOptions?.tourId === tourId ? departureOptions?.items ?? [] : [];
  const departuresLoading = Boolean(tourId && departureOptions?.tourId !== tourId && !departureError);
  const selectedDeparture = departures.find((item) => item.id === departureId);
  const items = useMemo(() => target === "tour" ? options?.tours ?? [] : target === "hotels" ? options?.hotels ?? [] : target === "ticket" ? options?.tickets ?? [] : [], [options, target]);
  function resetDeparture() { setDate(""); setDepartureId(null); setDepartureOptions(null); setDepartureError(""); }
  function reset(nextTarget?: Target) { setPreview(null); setMessage(""); setError(""); if (nextTarget) { setTarget(nextTarget); setSelectedIds([]); resetDeparture(); setCity(""); setFields(defaults[nextTarget]); setTourRateGroup(""); setCurrency(""); } }
  function payload() { return { target, tourIds: target === "tour" ? selectedIds : [], departureId: target === "tour" ? departureId : null, hotelIds: target === "hotels" ? selectedIds : [], city: target === "city" ? city : null, ticketIds: target === "ticket" ? selectedIds : [], priceFields: fields, direction, calculation, currency: target === "tour" ? currency : null, value: Number(value) }; }
  const hasSelection = target === "city" ? Boolean(city) : target === "tour" ? Boolean(selectedDeparture) && !departuresLoading : selectedIds.length > 0;
  const valid = hasSelection && fields.length > 0 && Number(value) > 0 && (target !== "tour" || Boolean(tourRateGroup && currency));
  const selectedCurrencyLabel = currency === "EUR" ? "یورو" : currency === "USD" ? "دلار" : "تومان";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || loading) return;
    setLoading(true); setPreview(null); setError(""); setMessage("");
    try {
    const response = await adminClientFetch("/admin/pricing/v2/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    const result = await response.json().catch(() => null);
    if (response.ok) setPreview(result); else setError(result?.detail ?? "پیش‌نمایش تغییر قیمت ناموفق بود.");
    } catch { setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید."); }
    finally { setLoading(false); }
  }
  async function apply() {
    if (!valid || loading || !preview?.canApply || !window.confirm(`${selectedDeparture ? `${departureLabel(selectedDeparture)}\n` : ""}${direction === "increase" ? "افزایش" : "کاهش"} ${fmt(value)} ${calculation === "percentage" ? "درصد" : "تومان"} روی ${preview.eligibleRates.toLocaleString("fa-IR")} نرخ اعمال شود؟`)) return;
    setLoading(true); setError("");
    try {
    const response = await adminClientFetch("/admin/pricing/v2/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    const result = await response.json().catch(() => null);
    if (response.ok) { setPreview(null); setMessage("تغییر گروهی قیمت‌ها با موفقیت و همراه گزارش ممیزی ذخیره شد."); } else setError(result?.detail ?? "اعمال تغییر ناموفق بود.");
    } catch { setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید."); }
    finally { setLoading(false); }
  }

  return <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="bulk-price-title">
    <h2 className="text-xl font-black text-brand" id="bulk-price-title">مدیریت گروهی نرخ‌ها</h2>
    <p className="mt-2 text-sm leading-7 text-muted">قیمت‌های یک تاریخ برگزاری تور، چند هتل، تمام هتل‌های یک شهر یا یک بلیت مشخص را یکجا افزایش یا کاهش دهید.</p>
    {loading && !options ? <p className="mt-5 rounded-xl bg-surface-muted p-4" role="status">در حال دریافت اطلاعات…</p> : null}
    {!loading && options && !options.tours.length && !options.hotels.length && !options.tickets.length ? <p className="mt-5 rounded-xl bg-surface-muted p-4 text-muted">هنوز قیمت قابل مدیریتی ثبت نشده است.</p> : null}
    {options ? <form className="mt-6" onSubmit={(event) => void submit(event)}><fieldset className="space-y-6" disabled={loading}>
      <fieldset><legend className="font-black text-brand">حالت انتخاب</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{(Object.keys(targetLabels) as Target[]).map((item) => <label className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${target === item ? "border-brand bg-brand-soft text-brand" : "border-border"}`} key={item}><input checked={target === item} className="ml-2" name="target" onChange={() => reset(item)} type="radio" />{targetLabels[item]}</label>)}</div></fieldset>
      <div>{target === "city" ? <label className="grid gap-2 text-sm font-bold"><span>شهر موردنظر</span><select className="min-h-12 rounded-xl border border-border px-4" onChange={(event) => { setCity(event.target.value); reset(); }} value={city}><option value="">انتخاب شهر</option>{options.cities.map((item) => <option key={item}>{item}</option>)}</select></label> : target === "hotels" ? <fieldset><legend className="text-sm font-black text-brand">هتل‌های موردنظر</legend><div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-border p-2">{items.map((item) => <label className="flex min-h-11 items-center gap-2 rounded-lg px-3 hover:bg-surface-muted" key={item.id}><input checked={selectedIds.includes(item.id)} onChange={() => { setSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]); reset(); }} type="checkbox" /><span>{item.label}{item.subtitle ? ` · ${item.subtitle}` : ""}</span></label>)}</div></fieldset> : <label className="grid gap-2 text-sm font-bold"><span>{target === "tour" ? "تور موردنظر" : "بلیت موردنظر"}</span><select className="min-h-12 rounded-xl border border-border px-4" onChange={(event) => { setSelectedIds(event.target.value ? [Number(event.target.value)] : []); resetDeparture(); reset(); }} value={selectedIds[0] ?? ""}><option value="">انتخاب کنید</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}{item.subtitle ? ` · ${item.subtitle}` : ""}</option>)}</select></label>}</div>
      {target === "tour" ? <div className="space-y-2">
        <DepartureFilters items={departures} date={date} id={String(departureId ?? "")} disabled={!tourId || departuresLoading}
          onDate={day => { setDate(day); setDepartureId(null); reset(); }}
          onStay={id => { setDepartureId(id ? Number(id) : null); reset(); }} />
        {departuresLoading ? <p className="text-sm text-muted" role="status">در حال دریافت تاریخ‌های برگزاری…</p> : null}
        {tourId && !departuresLoading && !departureError && !departures.length ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">برای این تور هنوز تاریخ برگزاری ثبت نشده است.</p> : null}
        {departureError ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{departureError}<button className="mr-3 underline" onClick={() => { resetDeparture(); setDepartureRetry((current) => current + 1); }} type="button">تلاش دوباره</button></div> : null}
      </div> : null}
      {target === "tour" ? <fieldset><legend className="text-sm font-black text-brand">بخش قیمت</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{([{ value: "hotel", label: "هتل" }, { value: "flight", label: "پرواز" }] as const).map((item) => <label className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${tourRateGroup === item.value ? "border-brand bg-brand-soft text-brand" : "border-border"}`} key={item.value}><input checked={tourRateGroup === item.value} className="ml-2" name="tour-rate-group" onChange={() => { setTourRateGroup(item.value); setCurrency(item.value === "flight" ? "IRT" : ""); setFields([]); reset(); }} type="radio" />{item.label}</label>)}</div>{tourRateGroup ? <div className="mt-4 space-y-4">{tourRateGroup === "hotel" ? <label className="grid gap-2 text-sm font-bold"><span>واحد قیمت هتل</span><select className="min-h-12 rounded-xl border border-border px-4" onChange={(event) => { setCurrency(event.target.value as AdjustmentCurrency); reset(); }} required value={currency}><option value="">واحد قیمت را انتخاب کنید</option><option value="IRT">تومان</option><option value="EUR">یورو</option><option value="USD">دلار</option></select></label> : <p className="rounded-xl bg-surface-muted p-3 text-sm font-bold text-brand">واحد قیمت پرواز: تومان</p>}<fieldset><legend className="text-sm font-black text-brand">کدام نرخ‌ها تغییر کند؟</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{tourFieldOptions[tourRateGroup].map((item) => <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3" key={item.value}><input checked={fields.includes(item.value)} onChange={() => { setFields((current) => current.includes(item.value) ? current.filter((field) => field !== item.value) : [...current, item.value]); reset(); }} type="checkbox" />{item.label}</label>)}</div>{tourRateGroup === "flight" ? <p className="mt-2 text-xs leading-6 text-muted">نرخ پرواز دوتخته و سینگل مستقل از هم تغییر می‌کند.</p> : null}</fieldset></div> : null}</fieldset> : <fieldset><legend className="text-sm font-black text-brand">کدام قیمت‌ها تغییر کند؟</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{fieldOptions[target].map((item) => <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3" key={item.value}><input checked={fields.includes(item.value)} onChange={() => { setFields((current) => current.includes(item.value) ? current.filter((field) => field !== item.value) : [...current, item.value]); reset(); }} type="checkbox" />{item.label}</label>)}</div></fieldset>}
      <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-2 text-sm font-bold"><span>نوع تغییر</span><select className="min-h-12 rounded-xl border px-4" onChange={(event) => { setDirection(event.target.value as Direction); reset(); }} value={direction}><option value="increase">افزایش نرخ</option><option value="decrease">کاهش نرخ</option></select></label><label className="grid gap-2 text-sm font-bold"><span>روش محاسبه</span><select className="min-h-12 rounded-xl border px-4" onChange={(event) => { setCalculation(event.target.value as Calculation); reset(); }} value={calculation}><option value="percentage">درصدی</option><option value="fixed">مبلغ ثابت</option></select></label><label className="grid gap-2 text-sm font-bold"><span>{calculation === "percentage" ? "مقدار درصد" : `مقدار ${target === "tour" ? selectedCurrencyLabel : "تومان"}`}</span><input
        className="min-h-12 rounded-xl border px-4 text-left tabular-nums"
        dir="ltr" name="adjustmentAmount" type="text" required
        inputMode={calculation === "percentage" || (target === "tour" && currency !== "IRT") ? "decimal" : "numeric"}
        pattern={calculation === "percentage" || (target === "tour" && currency !== "IRT") ? "[0-9,]+([.][0-9]{1,2})?" : "[0-9,]+"}
        onChange={(event) => {
          const input = event.target;
          const raw = normalizeAdjustmentAmount(input.value);
          if (!/^\d*(?:\.\d*)?$/.test(raw)) return;
          const caret = input.selectionStart;
          const prefixLength = caret === null || caret === undefined ? null : normalizeAdjustmentAmount(input.value.slice(0, caret)).length;
          setValue(raw); reset();
          if (prefixLength !== null) window.requestAnimationFrame(() => {
            const formatted = formatAdjustmentAmount(raw);
            let position = 0, count = 0;
            while (position < formatted.length && count < prefixLength) {
              if (formatted[position] !== ",") count++;
              position++;
            }
            input.setSelectionRange(position, position);
          });
        }}
        value={formatAdjustmentAmount(value)} /></label></div>
      {target === "tour" ? <p className="rounded-xl bg-surface-muted p-3 text-xs leading-6 text-muted">فقط نرخ‌های بخش و واحد پول انتخاب‌شده تغییر می‌کنند؛ قیمت‌های واحدهای دیگر دست‌نخورده می‌مانند.</p> : calculation === "percentage" ? <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted">در تغییر درصدی، تمام واحدهای پول انتخاب‌شده با همان درصد تغییر می‌کنند.</p> : <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted">مبلغ ثابت فقط روی نرخ‌های تومان/ریال اعمال می‌شود.</p>}
      <button className="min-h-12 w-full rounded-xl bg-brand font-black text-white disabled:opacity-50" disabled={!valid || loading} type="submit">{loading ? "در حال بررسی…" : "پیش‌نمایش تغییر گروهی"}</button>
    </fieldset></form> : null}
    {preview ? <section className="mt-6 rounded-2xl border border-brand/20 bg-brand-soft p-5"><h3 className="font-black text-brand">تأیید نهایی</h3>{selectedDeparture ? <p className="mt-3 text-sm font-bold">{items.find((item) => item.id === tourId)?.label} · {departureLabel(selectedDeparture)}</p> : null}<div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p>اقلام: <b>{preview.selectedItems.toLocaleString("fa-IR")}</b></p><p>نرخ‌های قابل تغییر: <b>{preview.eligibleRates.toLocaleString("fa-IR")}</b></p><p>کنارگذاشته‌شده: <b>{(preview.blockedRates + preview.skippedForeignCurrency).toLocaleString("fa-IR")}</b></p></div><p className="mt-3 text-sm">مجموع نرخ‌های {target === "tour" ? selectedCurrencyLabel : "تومانی"} قبل: <b>{fmt(preview.beforeTotalToman)}</b> · بعد: <b>{fmt(preview.afterTotalToman)}</b></p>{preview.blockedRates ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{preview.blockedRates.toLocaleString("fa-IR")} نرخ چون با این کاهش منفی می‌شد، بدون تغییر کنار گذاشته می‌شود. سایر نرخ‌های قابل تغییر اعمال خواهند شد.</p> : null}{!preview.canApply ? <p className="mt-3 text-sm text-amber-900">برای تاریخ، نوع نرخ و واحد پول انتخاب‌شده، نرخ قابل تغییری پیدا نشد. واحد پول و ثبت قیمت‌های این تاریخ را بررسی کنید.</p> : null}<button className="mt-4 min-h-11 w-full rounded-xl bg-[#eb5d9f] font-black text-white disabled:opacity-50" disabled={!preview.canApply || loading} onClick={() => void apply()} type="button">اعمال تغییر گروهی</button></section> : null}
    <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">این عملیات مستقیماً قیمت‌های ذخیره‌شده را تغییر می‌دهد، پیش از اجرا تأیید نهایی می‌گیرد و در گزارش ممیزی ثبت می‌شود.</p>
    {message ? <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">{message}</p> : null}{error ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">{error}</p> : null}
  </section>;
}
