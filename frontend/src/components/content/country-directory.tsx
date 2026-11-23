import Image from "next/image";
import Link from "next/link";
import { CountryFlag } from "./country-flag";
import { groupCountryOffers, type CountryOffer } from "@/lib/country-catalog";
import { formatCurrency } from "@/lib/currency";
import { normalizeCountryName } from "@/lib/country-name";
import styles from "./country-directory.module.css";

export function CountryDirectory({ offers, countries, href, label, title }: { offers: CountryOffer[]; countries: { name: string; imageId?: number | null }[]; href: string; label: string; title: string }) {
  const groups = groupCountryOffers(offers);
  return <section aria-label={title}>
    <div className={styles.heading}><h2>{title}</h2><Link href={`${href}${href.includes("?") ? "&" : "?"}showResults=1`}>همه کشورها ←</Link></div>
    <div className={styles.grid}>{groups.map((group) => <Link className={styles.card} key={group.country} href={`${href}${href.includes("?") ? "&" : "?"}showResults=1&country=${encodeURIComponent(group.country)}`}>
      <div className={styles.copy}><h3><CountryFlag country={group.country} imageId={countries.find((item) => normalizeCountryName(item.name) === group.country)?.imageId} />{group.country}</h3><p>{group.count.toLocaleString("fa-IR")} {label}</p><div>{group.cheapest?.amount ? <strong>{formatCurrency(group.cheapest.amount, group.cheapest.currency)}</strong> : null}<span>مشاهده {label} ←</span></div></div>
      <div className={styles.image}>{group.imageUrl ? <Image alt="" src={group.imageUrl} fill sizes="(max-width:640px) 40vw, 200px" /> : null}</div>
    </Link>)}</div>
    {!groups.length ? <p className="py-10 text-center text-sm text-muted">در حال حاضر مقصدی برای این بخش منتشر نشده است.</p> : null}
  </section>;
}
