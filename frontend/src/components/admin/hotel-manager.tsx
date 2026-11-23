"use client";

import { slugOnTitleEdit } from "@/lib/title-slug";
import { AutoSlugInput } from "@/components/admin/auto-slug-input";

import { type FormEvent, useEffect, useState } from "react";

import { CreateItemButton } from "@/components/admin/create-item-button";

import { InternalNoteField } from "@/components/admin/internal-note-field";
import { JalaliDateInput } from "@/components/admin/jalali-date-input";

import { CurrencySelect } from "@/components/admin/currency-select";
import { GalleryField } from "@/components/admin/gallery-field";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaUpload } from "@/components/admin/media-upload";
import { adminClientFetch } from "@/lib/admin-client";
import { adminErrorText } from "@/lib/admin-error";
import type {
  DestinationOption,
  HotelOption,
  HotelPricePeriodOption,
} from "@/types/editorial";

export type ManagedHotel = Required<
  Pick<
    HotelOption,
    | "id"
    | "name"
    | "slug"
    | "starRating"
    | "guestRating"
    | "destinationId"
    | "summary"
    | "description"
    | "galleryImageIds"
    | "status"
    | "isFeatured"
  >
> &
  Pick<
    HotelOption,
    | "hotelCode"
    | "serviceGrade"
    | "serviceType"
    | "serviceCategory"
    | "roomTypes"
    | "pricePeriods"
    | "defaultRoomType"
    | "region"
    | "city"
    | "address"
    | "imageId"
    | "imageAltText"
    | "locationDescription"
    | "roomsDescription"
    | "amenitiesDescription"
    | "diningDescription"
    | "bookingDescription"
    | "pricingDescription"
    | "policiesDescription"
    | "cancellationPolicy"
    | "basePrice"
    | "childWithBedPrice"
    | "childWithoutBedPrice"
    | "infantPrice"
    | "currency"
    | "maxGuests"
  > & { internalNote: string | null };

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";


export function HotelManager({
  initialItems,
  destinations,
  initialLoadError,
}: {
  initialItems: ManagedHotel[];
  destinations: DestinationOption[];
  initialLoadError?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<ManagedHotel | null>(null);
  const [imageId, setImageId] = useState<number | null>(null);
  const [galleryImageIds, setGalleryImageIds] = useState<number[]>([]);
  const [pricePeriods, setPricePeriods] = useState<HotelPricePeriodOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState(initialLoadError ?? "");
  const [busy, setBusy] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);

  useEffect(() => {
    let active = true;
    adminClientFetch(`/hotels?limit=500`, { credentials: "include" })
      .then(async (response) => { if (response.ok) return response.json(); throw new Error(`Admin hotels request failed (${response.status}).`); })
      .then((latest: ManagedHotel[]) => {
        if (active) setItems(latest);
      })
      .catch(() => {
        if (active) {
          setMessage("دریافت فهرست هتل‌ها ناموفق بود. اتصال Backend را بررسی کنید.");
        }
      });

  return () => { active = false; };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const orderedPeriods = [...pricePeriods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const pricePeriodsAreValid = orderedPeriods.every((period, index) => {
      const adultPrice = Number(period.adultPrice);
      const previous = orderedPeriods[index - 1];
      return Boolean(period.startDate && period.endDate) &&
        period.startDate <= period.endDate &&
        Number.isFinite(adultPrice) && adultPrice >= 0 &&
        (!previous || previous.endDate < period.startDate);
    });
    if (!pricePeriodsAreValid) {
      setBusy(false);
      setMessage("بازه‌های قیمت باید تاریخ و قیمت معتبر و بدون هم‌پوشانی داشته باشند.");
      return;
    }
    const payload = {
      name: form.get("name"),
      slug: editing ? slugOnTitleEdit(form.get("name"), editing.name, 200) : form.get("slug"),
      hotelCode: editing?.hotelCode ?? null,
      destinationId: Number(form.get("destinationId")),
      starRating: Number(form.get("starRating")),
      guestRating: form.get("guestRating") || null,
      serviceCategory: form.get("serviceCategory") || null,
      pricePeriods: orderedPeriods.map((period) => ({
        startDate: period.startDate,
        endDate: period.endDate,
        adultPrice: Number(period.adultPrice),
        childWithBedPrice: period.childWithBedPrice ? Number(period.childWithBedPrice) : null,
        childWithoutBedPrice: period.childWithoutBedPrice ? Number(period.childWithoutBedPrice) : null,
        infantPrice: period.infantPrice ? Number(period.infantPrice) : null,
        currency: period.currency,
      })),
      summary: form.get("summary"),
      description: form.get("description"),
      locationDescription: form.get("locationDescription") || null,
      amenitiesDescription: form.get("amenitiesDescription") || null,
      policiesDescription: form.get("policiesDescription") || null,
      cancellationPolicy: form.get("cancellationPolicy") || null,
      internalNote: form.get("internalNote") || null,
      basePrice: form.get("basePrice") ? Number(form.get("basePrice")) : null,
      childWithBedPrice: form.get("childWithBedPrice") ? Number(form.get("childWithBedPrice")) : null,
      childWithoutBedPrice: form.get("childWithoutBedPrice") ? Number(form.get("childWithoutBedPrice")) : null,
      infantPrice: form.get("infantPrice") ? Number(form.get("infantPrice")) : null,
      currency: form.get("currency") || "IRT",
      maxGuests: form.get("maxGuests") ? Number(form.get("maxGuests")) : null,
      region: form.get("region") || null,
      city: form.get("city") || null,
      address: form.get("address") || null,
      imageId,
      imageAltText: form.get("imageAltText") || null,
      galleryImageIds,
      status: form.get("status"),
      isFeatured: form.get("isFeatured") === "on",
    };
    const response = await adminClientFetch(
      `/hotels${editing ? `/${editing.id}` : ""}`,
      {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setMessage(await adminErrorText(response, "هتل"));
      return;
    }
    const saved = (await response.json()) as ManagedHotel;
    setItems((current) =>
      editing
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );
    if (editing) {
      // Keep the saved hotel open so uploaded media stays visible. Resetting the
      // editor here made a successful image save look like a failed one.
      setEditing(saved);
      setImageId(saved.imageId ?? null);
      setGalleryImageIds(saved.galleryImageIds);
      setPricePeriods(saved.pricePeriods ?? []);
      setEditorVersion((current) => current + 1);
      setMessage("تغییرات هتل و تصاویر آن ذخیره شد.");
      return;
    }
    setEditing(null);
    setImageId(null);
    setGalleryImageIds([]);
    setPricePeriods([]);
    setEditorVersion((current) => current + 1);
    event.currentTarget.reset();
    setMessage("هتل ذخیره شد و اکنون در فرم تور قابل انتخاب است.");
  }

  function startEdit(item: ManagedHotel) {
    setEditing(item);
    setImageId(item.imageId ?? null);
    setGalleryImageIds(item.galleryImageIds);
    setPricePeriods(item.pricePeriods ?? []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetEditor() {
    setEditing(null);
    setImageId(null);
    setGalleryImageIds([]);
    setPricePeriods([]);
    setEditorVersion((current) => current + 1);
    setMessage("");
  }

  async function saveMediaOnly(
    nextImageId = imageId,
    nextGalleryImageIds = galleryImageIds,
  ) {
    if (!editing) return;
    setBusy(true);
    setMessage("");
    const response = await adminClientFetch(`/hotels/${editing.id}/media`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageId: nextImageId,
        galleryImageIds: nextGalleryImageIds,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setMessage(await adminErrorText(response, "تصاویر هتل"));
      return;
    }
    const saved = (await response.json()) as ManagedHotel;
    setItems((current) =>
      current.map((item) => (item.id === saved.id ? saved : item)),
    );
    setEditing(saved);
    setImageId(saved.imageId ?? null);
    setGalleryImageIds(saved.galleryImageIds);
    setMessage("تصویر اصلی و گالری هتل ذخیره شدند.");
  }

  async function archive(item: ManagedHotel) {
    if (!window.confirm("این هتل و قیمت‌ها و پکیج‌های وابسته برای همیشه حذف شوند؟ این عمل قابل بازگردانی نیست.")) return;
    const response = await adminClientFetch(
      `/hotels/${item.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (response.ok) {
      setItems((current) => current.filter((row) => row.id !== item.id));
      setMessage("هتل برای همیشه حذف شد.");
    } else {
      setMessage(await adminErrorText(response, "حذف هتل ناموفق بود."));
    }
  }

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("fa");
  const filteredItems = normalizedSearch
    ? items.filter((item) =>
        [item.name, item.hotelCode, item.city, item.region]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("fa").includes(normalizedSearch)),
      )
    : items;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        data-admin-save-form
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
        id="admin-hotel-form"
        key={`${editing?.id ?? "new-hotel"}-${editorVersion}`}
        noValidate
        onSubmit={save}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">
            {editing ? "ویرایش هتل" : "هتل جدید"}
          </h2>
          <CreateItemButton formId="admin-hotel-form" label="هتل" onCreate={resetEditor} />
        </div>
        <input className={field} defaultValue={editing?.name} minLength={2} name="name" placeholder="نام هتل" required />
        {!editing ? <AutoSlugInput className={field} sourceName="name" maxLength={200} /> : null}
        <p className="text-sm text-muted">
          {editing?.hotelCode ? `شناسهٔ هتل: ${editing.hotelCode}` : "شناسهٔ هتل بعد از ثبت، بر اساس مقصد ساخته می‌شود."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold"><span>مقصد</span><select className={field} defaultValue={editing?.destinationId ?? ""} name="destinationId" required><option value="">بدون مقصد</option>{destinations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-bold"><span>شهر</span><select className={field} defaultValue={editing?.city ?? ""} name="city"><option value="">بدون شهر</option>{Array.from(new Set(destinations.map((item) => item.city).filter((city): city is string => Boolean(city)))).map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-bold"><span>منطقه هتل (اختیاری)</span><input className={field} defaultValue={editing?.region ?? ""} maxLength={120} name="region" placeholder="مثلاً تکسیم" /></label>
          <label className="grid gap-1 text-sm font-bold"><span>آدرس کامل هتل</span><input className={field} defaultValue={editing?.address ?? ""} maxLength={300} name="address" /></label>
          <label className="grid gap-1 text-sm font-bold"><span>تعداد ستاره</span><select className={field} defaultValue={editing?.starRating ?? 3} name="starRating" required>{[1, 2, 3, 4, 5].map((stars) => <option key={stars} value={stars}>{stars.toLocaleString("fa-IR")} ستاره</option>)}</select></label>
          <label className="grid gap-1 text-sm font-bold"><span>دسته‌بندی خدمت</span><select className={field} defaultValue={editing?.serviceCategory ?? ""} name="serviceCategory"><option value="">بدون دسته‌بندی</option><option value="city">هتل شهری</option><option value="resort">ریزورت</option><option value="beach">ساحلی</option><option value="family">خانوادگی</option><option value="business">تجاری</option><option value="luxury">لوکس</option></select></label>
        </div>
        <select className={field} defaultValue={editing?.guestRating ?? ""} name="guestRating"><option value="">امتیاز کاربران: ثبت نشده</option><option value="excellent">امتیاز کاربران: عالی</option><option value="good">امتیاز کاربران: خوب</option><option value="average">امتیاز کاربران: متوسط</option></select>
        <textarea className={field} defaultValue={editing?.summary} maxLength={300} minLength={10} name="summary" placeholder="خلاصه (حداقل ۱۰ کاراکتر)" required />
        <fieldset className="space-y-4 rounded-2xl border border-border bg-surface p-4"><legend className="px-2 font-black text-brand">تصاویر هتل</legend>
        <label className="grid gap-1 text-sm font-bold"><span>متن جایگزین عکس اصلی (Alt Text)</span><input className={field} defaultValue={editing?.imageAltText ?? editing?.name ?? ""} maxLength={255} name="imageAltText" placeholder="توصیف کوتاه و دقیق تصویر برای SEO و دسترسی‌پذیری" /></label>
        <MediaUpload
          currentId={imageId}
          label="عکس اصلی هتل"
          displayLabel="عکس اصلی"
          onRemoved={() => {
            setImageId(null);
            if (editing) void saveMediaOnly(null, galleryImageIds);
          }}
          onUploaded={async (id) => {
            setImageId(id);
            if (editing) await saveMediaOnly(id, galleryImageIds);
          }}
        />
        <p className="-mt-1 text-xs leading-6 text-muted">این تصویر روی کارت‌های هتل در سایت نمایش داده می‌شود. اگر ثبت نشود، کارت تصویر جایگزین نشان می‌دهد.</p>
        <GalleryField
          imageIds={galleryImageIds}
          label="عکس امکانات"
          uploadLabel="افزودن عکس امکانات"
          onChange={setGalleryImageIds}
          onPersist={
            editing
              ? (nextIds) => saveMediaOnly(imageId, nextIds)
              : undefined
          }
        />
        {editing ? (
          <button
            className="w-full rounded-xl border border-brand bg-brand-soft px-4 py-3 font-black text-brand disabled:opacity-50"
            disabled={busy}
            onClick={() => void saveMediaOnly()}
            type="button"
          >
            {busy ? "در حال ذخیره تصاویر..." : "ذخیره تصاویر هتل"}
          </button>
        ) : null}
        </fieldset>
        <RichTextEditor defaultValue={editing?.description} label="توضیحات هتل" minLength={20} name="description" required />
        <fieldset className="space-y-3 rounded-2xl border border-border bg-surface-muted p-3">
          <legend className="px-2 font-black text-brand">قیمت‌گذاری پایه</legend>
          <p className="text-xs leading-6 text-muted">اگر برای امروز یا آینده بازه‌ای ثبت نشده باشد، این قیمت‌ها نمایش داده می‌شوند.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm font-bold"><span>قیمت پایه بزرگسال</span><input className={field} defaultValue={editing?.basePrice ?? ""} min={0} name="basePrice" type="number" /></label>
            <label className="grid gap-1 text-sm font-bold"><span>کودک با تخت</span><input className={field} defaultValue={editing?.childWithBedPrice ?? ""} min={0} name="childWithBedPrice" type="number" /></label>
            <label className="grid gap-1 text-sm font-bold"><span>کودک بدون تخت</span><input className={field} defaultValue={editing?.childWithoutBedPrice ?? ""} min={0} name="childWithoutBedPrice" type="number" /></label>
            <label className="grid gap-1 text-sm font-bold"><span>نوزاد</span><input className={field} defaultValue={editing?.infantPrice ?? ""} min={0} name="infantPrice" type="number" /></label>
            <label className="grid gap-1 text-sm font-bold"><span>ارز قیمت پایه</span><CurrencySelect aria-label="ارز قیمت پایه هتل" className={field} defaultValue={editing?.currency ?? "IRT"} name="currency" /></label>
          </div>
        </fieldset>
        <HotelPricePeriodsField periods={pricePeriods} onChange={setPricePeriods} />
        <label className="space-y-1 text-xs font-bold">
          <span>حداکثر ظرفیت قابل رزرو</span>
          <input className={field} defaultValue={editing?.maxGuests ?? ""} max={1000} min={1} name="maxGuests" placeholder="مثلاً ۸ نفر" type="number" />
        </label>
        <HotelContentSection title="موقعیت و دسترسی"><RichTextEditor defaultValue={editing?.locationDescription ?? ""} label="فاصله‌ها، دسترسی‌ها و موقعیت هتل" name="locationDescription" /></HotelContentSection>
        <HotelContentSection title="امکانات هتل (هر مورد در یک خط)"><textarea className={`${field} min-h-36`} defaultValue={editing?.amenitiesDescription ?? ""} name="amenitiesDescription" placeholder={"استخر\nاینترنت رایگان\nرستوران\nترانسفر فرودگاهی"} /></HotelContentSection>
        <HotelContentSection title="قوانین عمومی هتل"><RichTextEditor defaultValue={editing?.policiesDescription ?? ""} label="قوانین پذیرش، ساعت ورود و خروج، مدارک و محدودیت‌های اقامت" name="policiesDescription" /></HotelContentSection>
        <HotelContentSection title="قوانین لغو و استرداد هتل"><RichTextEditor defaultValue={editing?.cancellationPolicy ?? ""} label="شرایط لغو رزرو، میزان جریمه و محدودیت‌های استرداد" name="cancellationPolicy" /></HotelContentSection>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={field} defaultValue={editing?.status ?? "draft"} name="status">
            <option value="draft">پیش‌نویس</option><option value="published">منتشرشده</option><option value="archived">بایگانی</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-border px-3"><input defaultChecked={editing?.isFeatured} name="isFeatured" type="checkbox" /> نمایش در پرفروش‌ترین‌های هتل‌ها</label>
        </div>
        <InternalNoteField defaultValue={editing?.internalNote} />
        <button className="w-full rounded-xl bg-brand px-4 py-3 font-black text-white disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "در حال ذخیره..." : "ذخیره محتوا"}
        </button>
        {editing ? <button className="text-sm font-bold text-brand" onClick={resetEditor} type="button">انصراف از ویرایش</button> : null}
        {message ? <p aria-live="polite" className="text-sm">{message}</p> : null}
      </form>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="space-y-3 p-5"><h2 className="text-xl font-black">محتوای ثبت‌شده</h2><label className="grid gap-1 text-sm font-bold"><span>جست‌وجو در این بخش</span><input className={field} onChange={(event) => setSearchQuery(event.target.value)} placeholder="عنوان ثبت‌شده را بنویسید..." type="search" value={searchQuery} /></label></div>
        {filteredItems.map((item) => (
          <article className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4" key={item.id}>
            <div className="min-w-0"><strong className="break-words">{item.name}</strong><p className="text-sm text-muted">{item.starRating} ستاره · {item.status}{item.region ? ` · ${item.region}` : ""}{item.hotelCode ? ` · ${item.hotelCode}` : ""}</p></div>
            <div className="flex w-full gap-3 sm:w-auto"><button className="flex-1 rounded-lg bg-brand px-3 py-2 font-bold text-white sm:flex-none" onClick={() => startEdit(item)} type="button">ویرایش</button><button className="flex-1 font-bold text-red-700 sm:flex-none" onClick={() => void archive(item)} type="button">حذف</button></div>
          </article>
        ))}
        {!filteredItems.length ? <p className="p-6 text-center text-sm text-muted">هتلی مطابق جست‌وجو پیدا نشد.</p> : null}
      </div>
    </section>
  );
}
function HotelPricePeriodsField({
  periods,
  onChange,
}: {
  periods: HotelPricePeriodOption[];
  onChange: (periods: HotelPricePeriodOption[]) => void;
}) {
  function updatePeriod(index: number, changes: Partial<HotelPricePeriodOption>) {
    onChange(
      periods.map((period, position) =>
        position === index ? { ...period, ...changes } : period,
      ),
    );
  }

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border bg-surface-muted p-3">
      <legend className="px-2 font-black text-brand">بازه‌های زمانی قیمت هتل</legend>
      <p className="text-xs leading-6 text-muted">
        قیمت بازه شامل امروز نمایش داده می‌شود؛ پس از پایان آن، اولین بازه آینده خودکار جایگزین می‌شود. بازه‌ها نباید هم‌پوشانی داشته باشند.
      </p>
      {periods.map((period, index) => (
        <article className="space-y-3 rounded-xl border border-border bg-background p-3" key={`${period.startDate}-${period.endDate}-${index}`}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_9rem_auto] lg:items-end">
            <label className="grid gap-1 text-sm font-bold"><span>شروع بازه</span><JalaliDateInput ariaLabel={`شروع بازه قیمت ${index + 1}`} className={field} onChange={(value) => updatePeriod(index, { startDate: value ?? "" })} value={period.startDate || null} /></label>
            <label className="grid gap-1 text-sm font-bold"><span>پایان بازه</span><JalaliDateInput ariaLabel={`پایان بازه قیمت ${index + 1}`} className={field} min={period.startDate || undefined} onChange={(value) => updatePeriod(index, { endDate: value ?? "" })} value={period.endDate || null} /></label>
            <label className="grid gap-1 text-sm font-bold"><span>قیمت اصلی</span><input className={field} min={0} onChange={(event) => updatePeriod(index, { adultPrice: event.target.value })} type="number" value={period.adultPrice} /></label>
            <label className="grid gap-1 text-sm font-bold"><span>واحد پول</span><CurrencySelect aria-label={`واحد پول بازه ${index + 1}`} className={field} onChange={(event) => updatePeriod(index, { currency: event.target.value })} value={period.currency} /></label>
            <button className="rounded-xl px-3 py-2 text-sm font-bold text-red-700" onClick={() => onChange(periods.filter((_, position) => position !== index))} type="button">حذف بازه</button>
          </div>
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-black text-brand">جزئیات بیشتر و ویرایش کامل</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-sm font-bold"><span>کودک با تخت</span><input className={field} min={0} onChange={(event) => updatePeriod(index, { childWithBedPrice: event.target.value || null })} type="number" value={period.childWithBedPrice ?? ""} /></label>
              <label className="grid gap-1 text-sm font-bold"><span>کودک بدون تخت</span><input className={field} min={0} onChange={(event) => updatePeriod(index, { childWithoutBedPrice: event.target.value || null })} type="number" value={period.childWithoutBedPrice ?? ""} /></label>
              <label className="grid gap-1 text-sm font-bold"><span>نوزاد</span><input className={field} min={0} onChange={(event) => updatePeriod(index, { infantPrice: event.target.value || null })} type="number" value={period.infantPrice ?? ""} /></label>
            </div>
          </details>
        </article>
      ))}
      <button className="rounded-xl border border-brand px-3 py-2 text-sm font-bold text-brand" onClick={() => onChange([...periods, { startDate: "", endDate: "", adultPrice: "", childWithBedPrice: null, childWithoutBedPrice: null, infantPrice: null, currency: "IRT" }])} type="button">+ افزودن بازه قیمت</button>
    </fieldset>
  );
}
function HotelContentSection({ title, children }: { title: string; children: React.ReactNode }) {

  return (
    <fieldset className="rounded-2xl border border-border bg-surface-muted p-3">
      <legend className="px-2 font-black text-brand">{title}</legend>
      {children}
    </fieldset>
  );
}
