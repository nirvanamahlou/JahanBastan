"use client";

import { slugOnTitleEdit } from "@/lib/title-slug";
import { AutoSlugInput } from "@/components/admin/auto-slug-input";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { CreateItemButton } from "@/components/admin/create-item-button";
import { InternalNoteField } from "@/components/admin/internal-note-field";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { adminClientFetch } from "@/lib/admin-client";
import type {
  ManagedDestination,
  ManagedCountry,
  MediaAsset,
  PublicationStatus,
} from "@/types/destination";

interface Props {
  countries: ManagedCountry[];
  initialDestinations: ManagedDestination[];
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?:
        | string
        | Array<{ loc?: Array<string | number>; msg?: string }>;
    };
    if (typeof body.detail === "string") {
      if (response.status === 409) {
        return body.detail.includes("slug")
          ? "این اسلاگ قبلاً برای مقصد دیگری استفاده شده است."
          : "یکی از تصاویر مقصد معتبر نیست یا ارتباط گالری قابل ذخیره نیست.";
      }
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      const fieldLabels: Record<string, string> = {
        title: "عنوان",
        slug: "اسلاگ",
        country: "کشور",
        city: "شهر",
        summary: "خلاصه",
        description: "توضیحات کامل",
        imageId: "تصویر",
        metaTitle: "عنوان SEO",
        metaDescription: "توضیحات SEO",
      };
      return body.detail
        .map((error) => {
          const field = String(error.loc?.at(-1) ?? "");
          return `${fieldLabels[field] ?? field}: ${error.msg ?? "مقدار نامعتبر است"}`;
        })
        .join(" — ");
    }
    return `خطای سرور (${response.status})`;
  } catch {
    return `خطای سرور (${response.status})`;
  }
}

export function DestinationManager({ countries, initialDestinations }: Props) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [editing, setEditing] = useState<ManagedDestination | null>(null);
  const [bestTravelTime, setBestTravelTime] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageId, setImageId] = useState<number | null>(null);
  const [galleryImageIds, setGalleryImageIds] = useState<number[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("altText", editing?.title ?? "");
      const response = await adminClientFetch(`/admin/media`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!response.ok) {
        setMessage(`بارگذاری تصویر ناموفق بود: ${await responseError(response)}`);
        return;
      }
      const asset = (await response.json()) as MediaAsset;
      setImageId(asset.id);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      setMessage("تصویر با موفقیت بارگذاری شد.");
    } catch {
      setMessage("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadGalleryImages(files: FileList | null) {
    if (!files?.length || galleryImageIds.length >= 6) return;
    setBusy(true);
    setMessage("");
    try {
      const selectedFiles = Array.from(files).slice(
        0,
        6 - galleryImageIds.length,
      );
      const errors: string[] = [];
      let uploadedCount = 0;
      for (const file of selectedFiles) {
        const body = new FormData();
        body.append("file", file);
        body.append("altText", editing?.title ?? "");
        const response = await adminClientFetch(`/admin/media`, {
          method: "POST",
          credentials: "include",
          body,
        });
        if (!response.ok) {
          errors.push(
            `${file.name}: ${await responseError(response)}`,
          );
          continue;
        }
        const asset = (await response.json()) as MediaAsset;
        setGalleryImageIds((ids) =>
          ids.includes(asset.id) ? ids : [...ids, asset.id].slice(0, 6),
        );
        uploadedCount += 1;
      }
      setMessage(
        [
          `${uploadedCount.toLocaleString("fa-IR")} تصویر به گالری اضافه شد.`,
          errors.length
            ? `${errors.length.toLocaleString("fa-IR")} تصویر ناموفق: ${errors.join(" — ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch {
      setMessage("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      title: form.get("title"),
      slug: editing ? slugOnTitleEdit(form.get("title"), editing.title, 180) : form.get("slug"),
      country: form.get("country"),
      city: form.get("city") || null,
      summary: form.get("summary"),
      description: form.get("description"),
      attractions: form.get("attractions") || null,
      bestTravelTime: bestTravelTime.trim() || null,
      travelTips: form.get("travelTips") || null,
      internalNote: form.get("internalNote") || null,
      metaTitle: form.get("metaTitle") || null,
      metaDescription: form.get("metaDescription") || null,
      imageId,
      galleryImageIds,
      isFeatured: form.get("isFeatured") === "on",
      status: form.get("status") as PublicationStatus,
    };
    try {
      const response = await adminClientFetch(
        editing
          ? `/admin/destinations/${editing.id}`
          : `/admin/destinations`,
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setMessage(`ذخیره مقصد ناموفق بود: ${await responseError(response)}`);
        return;
      }
      const saved = (await response.json()) as ManagedDestination;
      setDestinations((items) =>
        editing
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      setEditing(null);
      setBestTravelTime("");
      setImageId(null);
      setGalleryImageIds([]);
      setPreview(null);
      formElement.reset();
      setMessage("مقصد ذخیره شد.");
    } catch {
      setMessage("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: number) {
    if (!window.confirm("این مقصد و هتل‌های وابسته برای همیشه حذف شوند؟ این عمل قابل بازگردانی نیست.")) return;
    const response = await adminClientFetch(
      `/admin/destinations/${id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (response.ok) {
      setDestinations((items) => items.filter((item) => item.id !== id));
      setMessage("مقصد برای همیشه حذف شد.");
    }
  }

  function edit(item: ManagedDestination) {
    setEditing(item);
    setBestTravelTime(item.bestTravelTime ?? "");
    setImageId(item.imageId);
    setGalleryImageIds(item.galleryImageIds);
    setPreview(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetEditor() {
    setEditing(null);
    setBestTravelTime("");
    setImageId(null);
    setGalleryImageIds([]);
    setPreview(null);
    setMessage("");
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        data-admin-save-form
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
        id="admin-destination-form"
        key={editing?.id ?? "new"}
        onSubmit={save}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">
            {editing ? "ویرایش مقصد" : "مقصد جدید"}
          </h2>
          <CreateItemButton formId="admin-destination-form" label="مقصد" onCreate={resetEditor} />
        </div>
        <input className={inputClass} defaultValue={editing?.title} name="title" placeholder="عنوان" required />
        {!editing ? <AutoSlugInput className={inputClass} maxLength={180} /> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputClass} defaultValue={editing?.country ?? ""} name="country" required>
            <option value="">انتخاب کشور</option>
            {countries.filter((country) => country.status !== "archived").map((country) => <option key={country.id} value={country.name}>{country.name}{country.status !== "published" ? " (پیش‌نویس)" : ""}</option>)}
          </select>
          <input className={inputClass} defaultValue={editing?.city ?? ""} name="city" placeholder="شهر" />
        </div>
        <textarea className={inputClass} defaultValue={editing?.summary} name="summary" placeholder="خلاصه" required rows={2} />
        <RichTextEditor defaultValue={editing?.description} label="توضیحات کامل" name="description" required />
        <RichTextEditor defaultValue={editing?.attractions} label="جاذبه‌ها" name="attractions" rows={5} />
        <label className="space-y-1 text-xs font-bold" htmlFor="destination-best-travel-time">
          <span>بهترین زمان سفر</span>
          <input aria-describedby="destination-best-travel-time-help" className={inputClass} id="destination-best-travel-time" maxLength={160} name="bestTravelTime" onChange={(event) => setBestTravelTime(event.target.value)} placeholder="مثلاً فروردین تا خرداد و شهریور تا آبان" value={bestTravelTime} />
          <span className="block font-normal text-muted" id="destination-best-travel-time-help">
            این متن در صفحه مقصد نمایش داده می‌شود. {bestTravelTime.length.toLocaleString("fa-IR")} از ۱۶۰ کاراکتر
          </span>
        </label>
        <RichTextEditor defaultValue={editing?.travelTips} label="نکات سفر" name="travelTips" rows={5} />
        <div className="rounded-xl border border-border bg-surface-muted p-3">
          <h3 className="mb-3 font-black">تنظیمات SEO</h3>
          <input className={inputClass} defaultValue={editing?.metaTitle ?? ""} maxLength={70} name="metaTitle" placeholder="عنوان SEO، حداکثر ۷۰ کاراکتر" />
          <textarea className={`${inputClass} mt-2`} defaultValue={editing?.metaDescription ?? ""} maxLength={160} name="metaDescription" placeholder="توضیحات SEO، حداکثر ۱۶۰ کاراکتر" rows={2} />
        </div>
        <label className="block text-sm font-bold">
          تصویر مقصد (JPEG، PNG یا WebP، حداکثر ۵ مگابایت)
          <input className="mt-2 block w-full text-sm" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} type="file" />
        </label>
        {preview ? (
          <div className="relative h-36 overflow-hidden rounded-xl">
            <Image
              alt="پیش‌نمایش تصویر مقصد"
              className="object-cover"
              fill
              src={preview}
              unoptimized
            />
            <button
              className="absolute left-2 top-2 rounded-lg bg-white/95 px-3 py-2 text-sm font-bold text-danger shadow-sm"
              onClick={() => {
                setImageId(null);
                setPreview(null);
              }}
              type="button"
            >
              حذف تصویر
            </button>
          </div>
        ) : null}
        <div className="rounded-xl border border-border bg-surface-muted p-3">
          <label className="block text-sm font-bold">
            گالری مقصد — {galleryImageIds.length.toLocaleString("fa-IR")} از ۶ تصویر
            <input
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm"
              disabled={busy || galleryImageIds.length >= 6}
              multiple
              onChange={(event) => {
                void uploadGalleryImages(event.target.files);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          {galleryImageIds.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {galleryImageIds.map((id) => (
                <div
                  className="relative aspect-square overflow-hidden rounded-lg"
                  key={id}
                >
                  <Image
                    alt="تصویر گالری مقصد"
                    className="object-cover"
                    fill
                    src={`${PUBLIC_API_BASE_URL}/media/${id}`}
                    unoptimized
                  />
                  <button
                    aria-label="حذف تصویر از گالری"
                    className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                    onClick={() =>
                      setGalleryImageIds((ids) =>
                        ids.filter((imageId) => imageId !== id),
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputClass} defaultValue={editing?.status ?? "draft"} name="status">
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">بایگانی</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-border px-3">
            <input defaultChecked={editing?.isFeatured} name="isFeatured" type="checkbox" />
            ویژه
          </label>
        </div>
        <InternalNoteField defaultValue={editing?.internalNote} />
        <button className="w-full rounded-xl bg-brand px-4 py-3 font-black text-white disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "در حال انجام..." : "ذخیره مقصد"}
        </button>
        {message ? <p aria-live="polite" className="text-sm">{message}</p> : null}
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-5"><h2 className="text-xl font-black">مدیریت مقصدها</h2></div>
        <div className="max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <table className="w-full min-w-[38rem] text-right text-sm">
            <thead className="bg-surface-muted"><tr><th className="p-3">مقصد</th><th className="p-3">وضعیت</th><th className="p-3">تصویر</th><th className="p-3">عملیات</th></tr></thead>
            <tbody>
              {destinations.map((item) => (
                <tr className="border-t border-border" key={item.id}>
                  <td className="p-3"><strong>{item.title}</strong><span className="block text-muted">{item.country}{item.city ? `، ${item.city}` : ""}</span></td>
                  <td className="p-3">{item.status === "published" ? "منتشرشده" : item.status === "draft" ? "پیش‌نویس" : "بایگانی"}</td>
                  <td className="p-3">{item.imageId ? "دارد" : "ندارد"}</td>
                  <td className="p-3"><div className="flex gap-3"><button className="rounded-lg bg-brand px-3 py-2 font-bold text-white hover:bg-brand-strong" onClick={() => edit(item)} type="button">ویرایش</button><button className="text-red-700 disabled:opacity-40" onClick={() => archive(item.id)} type="button">حذف</button></div></td>
                </tr>
              ))}
              {!destinations.length ? <tr><td className="p-6 text-center text-muted" colSpan={4}>هنوز مقصدی ثبت نشده است.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
