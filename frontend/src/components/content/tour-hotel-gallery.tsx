"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeftIcon } from "@/components/layout/site-icons";
import catalogStyles from "./catalog-layout.module.css";
import styles from "./tour-hotel-presentation.module.css";

export function TourHotelGallery({ name, gallery }: { name: string; gallery: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const index = activeIndex < gallery.length ? activeIndex : 0;
  const image = gallery[index];
  if (!image) return <div className={`${styles.galleryStage} ${styles.galleryFallback}`}>بدون تصویر</div>;

  function move(offset: number) {
    setActiveIndex((index + offset + gallery.length) % gallery.length);
  }

  return (
    <section aria-label={`گالری تصاویر ${name}`} className={styles.gallery} dir="rtl">
      <div className={styles.galleryStage}>
        <Image
          alt={name}
          fill
          sizes="(max-width: 679px) 90vw, 260px"
          unoptimized={image.startsWith("https://")}
          src={image}
        />
        {gallery.length > 1 && <>
          <span className={styles.galleryCount} aria-live="polite">{(index + 1).toLocaleString("fa-IR")} از {gallery.length.toLocaleString("fa-IR")}</span>
          <button aria-label="تصویر قبلی هتل" className={styles.galleryArrow} onClick={() => move(-1)} type="button">
            <ArrowLeftIcon aria-hidden="true" className="size-4 rotate-180" />
          </button>
          <button aria-label="تصویر بعدی هتل" className={styles.galleryArrow} onClick={() => move(1)} type="button">
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
          </button>
        </>}
      </div>
    </section>
  );
}

export function HotelListGallery({ name, href, photos, rating }: { name: string; href: string; photos: string[]; rating?: string | null }) {
  const track = useRef<HTMLDivElement>(null);
  function move(direction: number) {
    const viewport = track.current;
    if (!viewport || !viewport.clientWidth) return;
    const index = Math.round(viewport.scrollLeft / viewport.clientWidth);
    const next = (index + direction + photos.length) % photos.length;
    viewport.scrollTo({
      left: next * viewport.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <div className={catalogStyles.hotelGallery} aria-label={`تصاویر ${name}`}>
      <div className={catalogStyles.hotelGalleryTrack} dir="ltr" ref={track}>
        {photos.map((src, index) => (
          <Link href={href} prefetch={false} key={src} aria-label={`مشاهده هتل ${name}، عکس ${index + 1}`}>
            <Image src={src} alt="" fill sizes="(max-width: 640px) 30vw, 260px" className="object-cover" />
          </Link>
        ))}
      </div>
      {rating && <span className={catalogStyles.hotelGalleryRating}>امتیاز مهمان: {rating}</span>}
      <button type="button" dir="ltr" className={catalogStyles.hotelGalleryLeft} aria-label="عکس به سمت چپ" onClick={() => move(-1)}>‹</button>
      <button type="button" dir="ltr" className={catalogStyles.hotelGalleryRight} aria-label="عکس به سمت راست" onClick={() => move(1)}>›</button>
    </div>
  );
}
