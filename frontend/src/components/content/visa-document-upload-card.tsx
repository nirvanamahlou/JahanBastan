"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type VisaApplication = {
  id: number;
  status: string;
  travelService: { id: number };
};

type Props = {
  serviceId: number;
  serviceTitle: string;
  requirements: string[];
};

const fallbackRequirements = [
  "فرم تکمیل‌شده درخواست ویزا",
  "تصویر صفحه اول پاسپورت",
  "عکس پرسنلی",
];
const editableStatuses = new Set(["draft", "needs_documents"]);
const acceptedFiles = "application/pdf,image/jpeg,image/png,image/webp";

async function applicationsForCurrentCustomer(): Promise<VisaApplication[] | null> {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/account/visa-applications`, {
    credentials: "include",
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json()) as VisaApplication[];
}

export function VisaDocumentUploadCard({ serviceId, serviceTitle, requirements }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const documentTypes = requirements.length ? requirements : fallbackRequirements;
  const accountHref = `/account/?tab=visa&serviceId=${serviceId}#visa-applications`;

  function setFile(documentType: string, file: File | null) {
    setFiles((current) => ({ ...current, [documentType]: file }));
    setNotice("");
  }

  async function saveDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFiles = documentTypes.flatMap((documentType) => {
      const file = files[documentType];
      return file ? [[documentType, file] as const] : [];
    });
    if (!selectedFiles.length) {
      setNotice("حداقل یک فایل را انتخاب کنید.");
      return;
    }

    setIsSaving(true);
    setNotice("");
    try {
      const applications = await applicationsForCurrentCustomer();
      if (applications === null) {
        setNotice("برای ذخیره امن مدارک، ابتدا وارد حساب کاربری شوید. پس از ورود، همین ویزا در تب درخواست ویزا انتخاب می‌شود.");
        return;
      }

      let application = applications.find(
        (item) => item.travelService.id === serviceId && editableStatuses.has(item.status),
      );
      if (!application) {
        const response = await fetch(`${PUBLIC_API_BASE_URL}/account/visa-applications`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ travelServiceId: serviceId }),
        }).catch(() => null);
        if (!response?.ok) {
          setNotice("ایجاد درخواست ویزا ناموفق بود. دوباره تلاش کنید.");
          return;
        }
        application = await response.json() as VisaApplication;
      }

      let uploadedCount = 0;
      for (const [documentType, file] of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("document_type", documentType);
        const response = await fetch(
          `${PUBLIC_API_BASE_URL}/account/visa-applications/${application.id}/documents`,
          { method: "POST", credentials: "include", body: formData },
        ).catch(() => null);
        if (response?.ok) uploadedCount += 1;
      }

      if (uploadedCount === selectedFiles.length) {
        setFiles({});
        setNotice(`${uploadedCount.toLocaleString("fa-IR")} مدرک برای ${serviceTitle} ذخیره شد. ادامه و وضعیت درخواست در پنل کاربری قابل مشاهده است.`);
      } else if (uploadedCount) {
        setNotice(`${uploadedCount.toLocaleString("fa-IR")} فایل ذخیره شد؛ باقی فایل‌ها را با فرمت PDF، JPG، PNG یا WebP و حجم حداکثر ۱۰ مگابایت دوباره بارگذاری کنید.`);
      } else {
        setNotice("بارگذاری انجام نشد. فرمت فایل و حجم حداکثر ۱۰ مگابایت را بررسی کنید.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="visa-upload-title" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-xl bg-highlight/15 text-xl text-highlight">↑</span>
      <h2 className="mt-4 font-black text-brand" id="visa-upload-title">بارگذاری مدارک ویزا</h2>
      <p className="mt-2 text-sm leading-7 text-muted">فایل‌های خود را همین‌جا انتخاب کنید. برای حفظ حریم خصوصی، پس از ورود فایل‌ها در درخواست ویزای حساب کاربری شما ذخیره می‌شوند.</p>
      {!isOpen ? <button className="mt-5 min-h-11 w-full rounded-xl bg-brand px-4 py-3 text-center font-black text-white transition hover:bg-primary hover:shadow-md" onClick={() => setIsOpen(true)} type="button">بارگذاری مدارک</button> : (
        <form className="mt-5 space-y-3" onSubmit={saveDocuments}>
          <p className="text-xs leading-6 text-muted">فرمت مجاز: PDF، JPG، PNG و WebP؛ حداکثر حجم هر فایل ۱۰ مگابایت.</p>
          {documentTypes.map((documentType) => (
            <label className="block rounded-xl border border-border bg-surface-muted p-3 text-sm font-bold text-brand" key={documentType}>
              <span>{documentType}</span>
              <input accept={acceptedFiles} className="mt-2 block w-full cursor-pointer rounded-lg border border-border bg-white px-2 py-2 text-xs font-normal text-foreground file:ml-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white" onChange={(event) => setFile(documentType, event.target.files?.[0] ?? null)} type="file" />
            </label>
          ))}
          {notice ? <p aria-atomic="true" aria-live="polite" className="rounded-xl bg-brand/10 px-3 py-2 text-xs font-bold leading-6 text-brand" role="status">{notice}</p> : null}
          <button className="min-h-11 w-full rounded-xl bg-brand px-4 py-3 text-center text-sm font-black text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "در حال ذخیره مدارک..." : "ذخیره مدارک"}</button>
          <Link className="block text-center text-xs font-bold text-brand underline underline-offset-4" href={accountHref}>مشاهده درخواست و مدارک در پنل کاربری</Link>
        </form>
      )}
    </section>
  );
}
