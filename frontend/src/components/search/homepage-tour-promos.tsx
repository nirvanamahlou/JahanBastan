"use client";

import Image from "next/image";
import Link from "next/link";
import { useHomepageSearchService } from "./homepage-search-guide";
import styles from "./homepage-tour-promos.module.css";

export function HomepageTourPromos({ imageUrl, title, href }: { imageUrl: string | null; title: string; href: string }) {
  const { serviceType } = useHomepageSearchService();
  if (serviceType !== "tour") return null;
  const items = [
    { image: imageUrl || "/images/design-rev48/tour-promo-1.webp", eyebrow: "پیشنهاد ویژه جهان باستان", title: imageUrl ? title : "تورهای خارجی، با برنامه‌ای روشن", description: "مقصد محبوبتان را با تاریخ و بودجه مناسب پیدا کنید.", href: imageUrl ? href : "/tours/", action: "مشاهده تورها" },
    { image: "/images/design-rev48/tour-promo-2.webp", eyebrow: "انتخاب دقیق‌تر سفر", title: "برای انتخاب تور مطمئن نیستید؟", description: "کارشناسان سفر برای مقایسه مسیرها همراه شما هستند.", href: "/contact/", action: "مشاوره رایگان" },
  ];
  return <section className={styles.promos} aria-label="پیشنهادهای ویژه تور">{items.map(item => <Link key={item.href} href={item.href} className={styles.promo}>
    <Image src={item.image} alt="" fill sizes="(max-width:760px) 94vw, 46vw" />
    <span><small>{item.eyebrow}</small><b>{item.title}</b><em>{item.description}</em><i>{item.action} ←</i></span>
  </Link>)}</section>;
}
