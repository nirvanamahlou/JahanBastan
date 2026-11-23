"use client";
import Image from "next/image";
import { useState } from "react";

export function TourHotelGallery({ name, gallery }: { name: string; gallery: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = gallery[activeIndex] ?? gallery[0] ?? null;

  if (!activeImage) {
    return <div className="grid aspect-[16/9] place-items-center border-b border-border bg-surface-muted text-sm text-muted">بدون تصویر</div>;
  }

  const showPrevious = () => setActiveIndex((current) => (current - 1 + gallery.length) % gallery.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % gallery.length);

  return (
    <section aria-label={`گالری تصاویر ${name}`} className="tour-hotel-gallery border-b border-[#ffd7e6] bg-gradient-to-b from-[#f7faff] to-white p-3 sm:p-4">
      <div className="tour-hotel-gallery-stage group relative aspect-[16/9] overflow-hidden rounded-2xl border border-[#e3edf9] bg-white sm:aspect-[2/1]">
        <Image
          alt={`${name} - تصویر ${activeIndex + 1}`}
          className="object-contain p-1 transition-transform duration-300 group-hover:scale-[1.01]"
          fill
          priority={false}
          sizes="(max-width: 1024px) 100vw, 900px"
          unoptimized={activeImage.startsWith("https://")} src={activeImage}
        />
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-brand shadow-sm">
          {(activeIndex + 1).toLocaleString("fa-IR")} از {gallery.length.toLocaleString("fa-IR")}
        </span>
        {gallery.length > 1 ? <>
          <button aria-label="تصویر قبلی هتل" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-brand/85 text-white shadow-lg backdrop-blur transition hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f12b75]/35" onClick={showPrevious} type="button">
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></svg>
          </button>
          <button aria-label="تصویر بعدی هتل" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-brand/85 text-white shadow-lg backdrop-blur transition hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f12b75]/35" onClick={showNext} type="button">
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></svg>
          </button>
        </> : null}
      </div>
      {gallery.length > 1 ? <div aria-label="انتخاب تصویر هتل" className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group">
        {gallery.map((imageId, index) => <button aria-label={`نمایش تصویر ${index + 1} از ${name}`} aria-pressed={activeIndex === index} className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition sm:w-24 ${activeIndex === index ? "border-[#f12b75] shadow-[0_5px_14px_rgba(241,43,117,.2)]" : "border-transparent opacity-75 hover:border-brand/35 hover:opacity-100"}`} key={imageId} onClick={() => setActiveIndex(index)} type="button">
          <Image alt="" className="object-cover" fill sizes="96px" unoptimized={imageId.startsWith("https://")} src={imageId} />
        </button>)}
      </div> : null}
    </section>
  );
}
