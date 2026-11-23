"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { adminClientFetch } from "@/lib/admin-client";

type Props = {
  currentId: number | null;
  fallbackUrl?: string;
  label: string;
  displayLabel?: string;
  aspect?: "square" | "wide";
  maxFiles?: number;
  multiple?: boolean;
  onUploaded: (id: number) => void | Promise<void>;
  onRemoved?: () => void;
};

export function MediaUpload({
  currentId,
  fallbackUrl,
  label,
  displayLabel,
  aspect = "square",
  maxFiles = 1,
  multiple = false,
  onUploaded,
  onRemoved,
}: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = currentId ? `${PUBLIC_API_BASE_URL}/media/${currentId}` : fallbackUrl ?? null;

  async function upload(files?: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    try {
      const selectedFiles = Array.from(files).slice(0, maxFiles);
      const errors: string[] = [];
      let uploadedCount = 0;
      for (const file of selectedFiles) {
        const body = new FormData();
        body.append("file", file);
        body.append("altText", label);
        const response = await adminClientFetch(`/admin/media`, {
          method: "POST",
          credentials: "include",
          body,
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            detail?: unknown;
          };
          errors.push(
            `${file.name}: ${
              typeof data.detail === "string"
                ? data.detail
                : `خطای سرور (${response.status})`
            }`,
          );
          continue;
        }
        const asset = (await response.json()) as { id: number };
        await onUploaded(asset.id);
        uploadedCount += 1;
      }
      setMessage(
        [
          `${uploadedCount.toLocaleString("fa-IR")} تصویر بارگذاری شد.`,
          errors.length
            ? `${errors.length.toLocaleString("fa-IR")} تصویر ناموفق: ${errors.join(" — ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ارتباط با سرور برقرار نشد.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold">
        {displayLabel ?? (multiple ? "تصاویر مربعی" : aspect === "wide" ? "تصویر افقی" : "تصویر مربعی")}
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full text-sm"
          disabled={busy}
          multiple={multiple}
          onChange={(event) => {
            void upload(event.target.files);
            event.currentTarget.value = "";
          }}
          type="file"
        />
      </label>
      {preview ? (
        <div
          className={`relative w-full overflow-hidden rounded-xl bg-surface-muted ${
            aspect === "wide" ? "aspect-video" : "aspect-square max-w-52"
          }`}
        >
          <Image alt={label} className="object-cover" fill src={preview} unoptimized />
          {onRemoved && currentId ? (
            <Button
              className="absolute left-2 top-2 min-h-9 bg-white/95 px-3 text-danger shadow-sm"
              onClick={() => {
                setMessage("تصویر از این بخش حذف شد؛ برای اعمال نهایی ذخیره کنید.");
                onRemoved();
              }}
              type="button"
              variant="ghost"
            >
              حذف تصویر
            </Button>
          ) : null}
        </div>
      ) : null}
      {message ? <p aria-live="polite" className="text-sm">{message}</p> : null}
    </div>
  );
}
