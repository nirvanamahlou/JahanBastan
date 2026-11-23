"use client";

import { slugOnTitleEdit } from "@/lib/title-slug";
import { AutoSlugInput } from "@/components/admin/auto-slug-input";

import Image from "next/image";
import { type FormEvent, useState } from "react";

import { CreateItemButton } from "@/components/admin/create-item-button";
import { useRouter } from "next/navigation";

import { MediaUpload } from "@/components/admin/media-upload";
import { GalleryField } from "@/components/admin/gallery-field";
import { InternalNoteField } from "@/components/admin/internal-note-field";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { adminClientFetch } from "@/lib/admin-client";
import type { ManagedCountry } from "@/types/destination";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

export function CountryManager({
  initialCountries,
}: {
  initialCountries: ManagedCountry[];
}) {
  const router = useRouter();
  const [countries, setCountries] = useState(initialCountries);
  const [editing, setEditing] = useState<ManagedCountry | null>(null);
  const [imageId, setImageId] = useState<number | null>(null);
  const [galleryImageIds, setGalleryImageIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      slug: editing ? slugOnTitleEdit(form.get("name"), editing.name, 120) : form.get("slug"),
      imageId,
      galleryImageIds,
      internalNote: form.get("internalNote") || null,
      displayOrder: Number(form.get("displayOrder") || 0),
      status: form.get("status"),
    };
    const response = await adminClientFetch(
      `/admin/countries${editing ? `/${editing.id}` : ""}`,
      {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setMessage("ذخیره کشور ناموفق بود؛ نام و اسلاگ باید یکتا باشند.");
      return;
    }
    const saved = (await response.json()) as ManagedCountry;
    setCountries((items) =>
      editing
        ? items.map((item) => (item.id === saved.id ? saved : item))
        : [...items, saved],
    );
    setEditing(null);
    setImageId(null);
    setGalleryImageIds([]);
    event.currentTarget.reset();
    setMessage("کشور ذخیره شد.");
    router.refresh();
  }

  function resetEditor() {
    setEditing(null);
    setImageId(null);
    setGalleryImageIds([]);
    setMessage("");
  }

  async function archive(country: ManagedCountry) {
    if (!window.confirm("این کشور برای همیشه حذف شود؟ این عمل قابل بازگردانی نیست.")) return;
    const response = await adminClientFetch(
      `/admin/countries/${country.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (response.ok) {
      setCountries((items) => items.filter((item) => item.id !== country.id));
      setMessage("کشور برای همیشه حذف شد.");
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        data-admin-save-form
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
        id="admin-country-form"
        key={editing?.id ?? "new-country"}
        onSubmit={save}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">
            {editing ? "ویرایش کشور" : "کشور جدید"}
          </h2>
          <CreateItemButton formId="admin-country-form" label="کشور" onCreate={resetEditor} />
        </div>
        <input
          className={field}
          defaultValue={editing?.name}
          name="name"
          placeholder="نام کشور"
          required
        />
        {!editing ? (
          <AutoSlugInput className={field} sourceName="name" maxLength={120} />
        ) : null}
        <MediaUpload
          currentId={imageId}
          label={editing?.name ? `پرچم ${editing.name}` : "پرچم کشور"}
          onRemoved={() => setImageId(null)}
          onUploaded={setImageId}
        />
        <GalleryField
          imageIds={galleryImageIds}
          label="گالری کشور"
          onChange={setGalleryImageIds}
        />
        <p className="text-sm font-bold">ترتیب صفحه اصلی: صفر = مخفی؛ ۱ به بالا = نمایش تورها و هتل‌ها به ترتیب</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={field}
            defaultValue={editing?.displayOrder ?? 0}
            min={0}
            aria-label="ترتیب صفحه اصلی: صفر مخفی، از ۱ به بالا نمایش"
            title="ترتیب صفحه اصلی: صفر مخفی، از ۱ به بالا نمایش"
            name="displayOrder"
            type="number"
          />
          <select
            className={field}
            defaultValue={editing?.status ?? "draft"}
            name="status"
          >
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">بایگانی</option>
          </select>
        </div>
        <InternalNoteField defaultValue={editing?.internalNote} />
        <button
          className="w-full rounded-xl bg-brand px-4 py-3 font-black text-white"
          disabled={busy}
          type="submit"
        >
          {busy ? "در حال ذخیره..." : "ذخیره کشور"}
        </button>
        {editing ? (
          <button className="text-sm font-bold text-brand" onClick={resetEditor} type="button">
            انصراف از ویرایش
          </button>
        ) : null}
        {message ? <p aria-live="polite">{message}</p> : null}
      </form>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <h2 className="p-5 text-xl font-black">کشورهای ثبت‌شده</h2>
        {countries.map((country) => (
          <article
            className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            key={country.id}
          >
            <div>
              <div className="flex items-center gap-2">
                {country.imageId ? <Image alt={`پرچم ${country.name}`} className="h-5 w-7 rounded border border-border object-cover" height={20} src={`${PUBLIC_API_BASE_URL}/media/${country.imageId}`} unoptimized width={28} /> : null}
                <strong>{country.name}</strong>
              </div>
              <p className="text-sm text-muted">{country.status}</p>
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <button
                className="rounded-lg bg-brand px-3 py-2 font-bold text-white"
                onClick={() => {
                  setEditing(country);
                  setImageId(country.imageId);
                  setGalleryImageIds(country.galleryImageIds);
                }}
                type="button"
              >
                ویرایش
              </button>
              <button
                className="font-bold text-red-700"
                onClick={() => void archive(country)}
                type="button"
              >
                حذف
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
