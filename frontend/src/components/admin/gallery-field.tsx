"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { MediaUpload } from "@/components/admin/media-upload";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

export function GalleryField({
  imageIds,
  label,
  uploadLabel,
  onChange,
  onPersist,
}: {
  imageIds: number[];
  label: string;
  uploadLabel?: string;
  onChange: Dispatch<SetStateAction<number[]>>;
  onPersist?: (imageIds: number[]) => void | Promise<void>;
}) {
  const imageIdsRef = useRef(imageIds);

  useEffect(() => {
    imageIdsRef.current = imageIds;
  }, [imageIds]);

  async function updateImages(updater: (ids: number[]) => number[]) {
    const next = updater(imageIdsRef.current);
    imageIdsRef.current = next;
    onChange(next);
    await onPersist?.(next);
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-3 text-sm font-bold">
        {label} — {imageIds.length.toLocaleString("fa-IR")} از ۶ تصویر مربعی
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {imageIds.map((id) => (
          <div
            className="relative aspect-square overflow-hidden rounded-lg bg-surface-muted"
            key={id}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="size-full object-cover"
              src={`${PUBLIC_API_BASE_URL}/media/${id}`}
            />
            <button
              aria-label="حذف تصویر از گالری"
              className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
              onClick={() =>
                void updateImages((ids) =>
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
      {imageIds.length < 6 ? (
        <MediaUpload
          displayLabel={uploadLabel}
          currentId={null}
          label={label}
          maxFiles={6 - imageIds.length}
          multiple
          onUploaded={(id) =>
            updateImages((ids) =>
              ids.includes(id) ? ids : [...ids, id].slice(0, 6),
            )
          }
        />
      ) : (
        <p className="text-sm text-muted">حداکثر ۶ تصویر ثبت شده است.</p>
      )}
    </div>
  );
}
