"use client";

import Image from "next/image";
import { useState } from "react";
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
    <section aria-label={`گالری تصاویر ${name}`} className={styles.gallery}>
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
            <span aria-hidden="true">›</span>
          </button>
          <button aria-label="تصویر بعدی هتل" className={styles.galleryArrow} onClick={() => move(1)} type="button">
            <span aria-hidden="true">‹</span>
          </button>
        </>}
      </div>
      {gallery.length > 1 && <div aria-label="انتخاب تصویر هتل" className={styles.galleryThumbs} role="group">
        {gallery.map((src, i) => (
          <button aria-label={`نمایش تصویر ${i + 1} از ${name}`} aria-pressed={index === i} className={styles.galleryThumb} key={src} onClick={() => setActiveIndex(i)} type="button">
            <Image alt="" fill sizes="40px" unoptimized={src.startsWith("https://")} src={src} />
          </button>
        ))}
      </div>}
    </section>
  );
}
