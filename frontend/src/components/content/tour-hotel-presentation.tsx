import type { ReactNode } from "react";
import Link from "next/link";
import { HotelStars } from "./hotel-stars";
import { TourHotelGallery } from "./tour-hotel-gallery";
import styles from "./tour-hotel-presentation.module.css";

type Props = {
  name: string;
  href?: string;
  images: string[];
  location: string;
  stars?: number;
  summary?: string | null;
  facilities?: string | null;
  badges: ReactNode;
  amenities: ReactNode;
  rates?: ReactNode;
};

export function TourHotelPresentation({ name, href, images, location, stars, summary, facilities, badges, amenities, rates }: Props) {
  return (
    <div className={styles.presentation} data-standalone-hotel>
      <div className={styles.media}>
        <TourHotelGallery name={name} gallery={images} />
      </div>
      <div className={styles.hotelInfo}>
        <div className={styles.hotelHeading}>
          <h3>{href ? <Link href={href}>{name}</Link> : name}</h3>
          {Number(stars) > 0 && <span className={styles.rating}>
            <HotelStars rating={stars ?? 0} size="sm" />
            <span>{stars?.toLocaleString("fa-IR")} ستاره</span>
          </span>}
        </div>
        {location && <p className={styles.location}>{location}</p>}
        {badges && <div className={styles.badges}>{badges}</div>}
        {amenities && <div className={styles.amenities}>{amenities}</div>}
        {(summary || facilities || href) && <div className={styles.hotelActions}>
          {href && <Link href={href}>جزئیات هتل <span aria-hidden="true">←</span></Link>}
          {(summary || facilities) && <details>
            <summary>دربارهٔ هتل و امکانات</summary>
            {summary && <p>{summary}</p>}
            {facilities && facilities !== summary && <p>{facilities}</p>}
          </details>}
        </div>}
      </div>
      {rates && <div className={styles.prices}>{rates}</div>}
    </div>
  );
}
