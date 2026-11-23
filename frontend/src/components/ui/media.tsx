"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useState } from "react";

type ImageUploadProps = {
  id: string;
  label: string;
  name?: string;
  required?: boolean;
};

export function ImageUpload({ id, label, name = id, required }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold">{label}</label>
      <input id={id} name={name} type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={handleChange} className="min-h-12 rounded-xl border border-dashed border-brand/40 bg-surface p-3 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-bold file:text-brand" />
      <p className="text-xs text-muted">JPG، PNG یا WebP؛ حداکثر اندازه فایل در Backend اعمال می‌شود.</p>
      {preview ? <div className="relative aspect-video overflow-hidden rounded-xl border border-border"><Image src={preview} alt="پیش‌نمایش تصویر انتخاب‌شده" fill unoptimized className="object-cover" /></div> : null}
    </div>
  );
}

export function ImageGallery({ images }: { images: ReadonlyArray<{ src: string; alt: string }> }) {
  const [active, setActive] = useState(0);
  if (!images.length) return null;
  return (
    <section aria-label="گالری تصاویر">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface-muted">
        <Image src={images[active].src} alt={images[active].alt} fill sizes="(max-width: 768px) 100vw, 70vw" className="object-cover" />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {images.map((image, index) => (
          <button key={image.src} type="button" onClick={() => setActive(index)} aria-label={`نمایش تصویر ${index + 1}`} aria-pressed={active === index} className={`relative aspect-video overflow-hidden rounded-xl border-2 ${active === index ? "border-brand" : "border-transparent"}`}>
            <Image src={image.src} alt="" fill sizes="10rem" className="object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
