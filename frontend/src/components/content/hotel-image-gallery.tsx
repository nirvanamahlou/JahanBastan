"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type HotelImageGalleryProps = {
  hotelName: string;
  imageAltText?: string | null;
  imageIds: number[];
};

function imageUrl(imageId: number) {
  return `${PUBLIC_API_BASE_URL}/media/${imageId}`;
}

export function HotelImageGallery({
  hotelName,
  imageAltText,
  imageIds,
}: HotelImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const activeIndex = Math.min(selectedIndex, Math.max(imageIds.length - 1, 0));
  const activeImageId = imageIds[activeIndex] ?? imageIds[0];

  useEffect(() => {
    if (!isViewerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const openButton = openButtonRef.current;
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsViewerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = viewerRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      );
      if (!focusable?.length) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnKeyDown);
      openButton?.focus();
    };
  }, [isViewerOpen]);

  if (!activeImageId) return null;

  return (
    <section aria-label={`گالری تصاویر ${hotelName}`} className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-sm sm:rounded-3xl">
        <Image
          alt={activeIndex === 0 && imageAltText ? imageAltText : `${hotelName}، تصویر ${activeIndex + 1}`}
          className="object-cover"
          fill
          priority
          sizes="(max-width: 768px) calc(100vw - 2rem), min(72rem, calc(100vw - 4rem))"
          src={imageUrl(activeImageId)}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/15 to-transparent p-4 sm:p-5">
          <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            {(activeIndex + 1).toLocaleString("fa-IR")} از {imageIds.length.toLocaleString("fa-IR")}
          </span>
          <button
            className="min-h-10 rounded-xl bg-white px-4 text-sm font-black text-brand shadow-lg transition hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            onClick={() => setIsViewerOpen(true)}
            ref={openButtonRef}
            type="button"
          >
            مشاهده همه
          </button>
        </div>
      </div>

      {imageIds.length > 1 ? (
        <div
          aria-label="تصاویر دیگر هتل"
          className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] sm:gap-3"
        >
          {imageIds.map((imageId, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                aria-label={`نمایش تصویر ${index + 1} از ${hotelName}`}
                aria-pressed={isActive}
                className={`relative aspect-[4/3] w-24 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-surface-muted transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent sm:w-32 ${
                  isActive
                    ? "border-brand opacity-100"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                key={imageId}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="128px"
                  src={imageUrl(imageId)}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {isViewerOpen ? (
        <div
          aria-label={`همه تصاویر ${hotelName}`}
          aria-modal="true"
          className="fixed inset-0 z-[70] overflow-y-auto bg-brand/85 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsViewerOpen(false);
          }}
          role="dialog"
        >
          <div
            className="mx-auto w-full max-w-6xl rounded-3xl bg-surface p-4 shadow-2xl sm:p-6"
            ref={viewerRef}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-brand sm:text-xl">
                  تصاویر {hotelName}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {imageIds.length.toLocaleString("fa-IR")} تصویر
                </p>
              </div>
              <button
                aria-label="بستن گالری تصاویر"
                className="grid size-11 place-items-center rounded-xl border border-border text-xl font-black text-brand transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
                onClick={() => setIsViewerOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {imageIds.map((imageId, index) => (
                <button
                  aria-label={`نمایش تصویر ${index + 1} در گالری اصلی`}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-muted text-right focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
                  key={imageId}
                  onClick={() => {
                    setSelectedIndex(index);
                    setIsViewerOpen(false);
                  }}
                  type="button"
                >
                  <Image
                    alt={`${hotelName}، تصویر ${index + 1}`}
                    className="object-cover transition duration-300 hover:scale-105"
                    fill
                    sizes="(max-width: 640px) calc(100vw - 3rem), (max-width: 1024px) 45vw, 22rem"
                    src={imageUrl(imageId)}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
