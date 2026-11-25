import Image from "next/image";
import Link from "next/link";

import { ArrowLeftIcon, CreditCardIcon, PhoneIcon, SuitcaseIcon } from "@/components/layout/site-icons";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import styles from "./homepage-tour-promos.module.css";

export function HomepagePromos({ settings }: { settings?: Record<string, string> }) {
  const imageId = Number(settings?.homePromoImageId);
  const imageUrl = Number.isSafeInteger(imageId) && imageId > 0 ? `${PUBLIC_API_BASE_URL}/media/${imageId}` : null;
  const configuredHref = settings?.homePromoHref?.trim() ?? "";
  const tourHref = /^\/(?!\/)[^\\\r\n\t]*$/.test(configuredHref) ? configuredHref : "/tours/";
  const items = [
    {
      id: "tours", title: settings?.homePromoTitle?.trim() || "تورهای جهان باستان",
      description: "تورهای داخلی و خارجی", href: tourHref, icon: SuitcaseIcon, style: styles.tours,
    },
    {
      id: "installments", title: "خرید اقساطی سفر",
      description: "شرایط و ثبت درخواست", href: "/installments/", icon: CreditCardIcon, style: styles.installments,
    },
    {
      id: "contact", title: "مشاوره سفر",
      description: "گفت‌وگو با کارشناسان", href: "/contact/#contact-details", icon: PhoneIcon, style: styles.contact,
    },
  ];

  return (
    <nav className={styles.promos} aria-label="پیوندهای سریع سفر" data-home-promos>
      {items.map(({ id, title, href, description, icon: Icon, style }) => (
        <Link key={id} href={href} className={`${styles.promo} ${style}`}>
          {id === "tours" && imageUrl ? (
            <div className={styles.artwork}>
              <Image src={imageUrl} alt="" fill sizes="150px" />
            </div>
          ) : null}
          <span className={styles.icon}><Icon aria-hidden="true" /></span>
          <span className={styles.copy}>
            <strong>{title}</strong>
            <span>{description}</span>
          </span>
          <ArrowLeftIcon className={styles.arrow} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
