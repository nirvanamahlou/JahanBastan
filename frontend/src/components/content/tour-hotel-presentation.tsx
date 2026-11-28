import type { ReactNode } from "react";
import Link from "next/link";
import { HotelStars } from "./hotel-stars";
import { TourHotelGallery } from "./tour-hotel-gallery";
import styles from "./tour-hotel-presentation.module.css";

type Props = {
  name: string;
  href?: string;
  images: string[];
  locationHref: string;
  stars?: number;
  badges: ReactNode;
  amenities: ReactNode;
  rates?: ReactNode;
};

export function TourHotelPresentation({ name, href, images, locationHref, stars, badges, amenities, rates }: Props) {
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
          </span>}
        </div>
        <a className={styles.location} href={locationHref} target="_blank" rel="noreferrer">لوکیشن</a>
        {badges && <div className={styles.badges}>{badges}</div>}
        {amenities && <div className={styles.amenities}>{amenities}</div>}

      </div>
      {rates && <div className={styles.prices}>{rates}</div>}
    </div>
  );
}
