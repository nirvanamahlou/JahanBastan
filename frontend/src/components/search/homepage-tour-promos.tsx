"use client";

import Image from "next/image";
import Link from "next/link";
import { useHomepageSearchService } from "./homepage-search-guide";
import styles from "./homepage-tour-promos.module.css";

export function HomepageTourPromos({ imageUrl, title, href }: { imageUrl: string | null; title: string; href: string }) {
  const { serviceType } = useHomepageSearchService();
  if (serviceType !== "tour") return null;
  const items = [
    { image: imageUrl || "/images/design-rev48/tour-promo-1.webp", href: imageUrl ? href : "/tours/", label: imageUrl && title ? title : "مشاهده تورها" },
    { image: "/images/design-rev48/tour-promo-2.webp", href: "/contact/", label: "مشاوره رایگان" },
  ];
  return <section className={styles.promos} aria-label="پیشنهادهای ویژه تور">{items.map(item => <Link key={item.href} href={item.href} className={styles.promo} aria-label={item.label}>
    <Image src={item.image} alt="" fill sizes="(max-width:760px) 94vw, 46vw" />
  </Link>)}</section>;
}
