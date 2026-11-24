import Link from "next/link";
import styles from "./site-footer.module.css";

import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { getPublicSettings } from "@/lib/api/public-settings";
import { toPersianDigits } from "@/lib/persian-number";

import { BrandLogo } from "./brand-logo";
import { EnamadSeal } from "./enamad-seal";
import {
  ClockIcon,
  InstagramIcon,
  LocationIcon,
  MailIcon,
  PhoneIcon,
  TelegramIcon,
  WhatsappIcon,
} from "./site-icons";

const socialIcons = {
  instagram: InstagramIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsappIcon,
} as const;

const socialOrder = ["instagram", "telegram", "whatsapp"] as const;
function safeInternalHref(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  return candidate?.startsWith("/") ? candidate : fallback;
}

function safeExternalHref(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

export async function SiteFooter() {
  const settings = await getPublicSettings().catch(() => null);
  const values = settings?.socialLinks ?? {};
  const siteName = settings?.siteName ?? siteConfig.name;
  const phone = settings?.phone ?? siteConfig.phoneDisplay;
  const address = settings?.address ?? siteConfig.address;
  const email = settings?.email?.trim() || "contact@example.com";
  const savedWorkingHours = settings?.workingHours?.trim();
  const normalizedSavedWorkingHours = savedWorkingHours
    ? toPersianDigits(savedWorkingHours)
    : "";
  const workingHours = toPersianDigits(
    normalizedSavedWorkingHours === "شنبه تا چهارشنبه، ۹ تا ۱۷"
      ? siteConfig.businessHours
      : normalizedSavedWorkingHours || siteConfig.businessHours,
  );
  const footerBrandTitle = values.footerBrandTitle?.trim() || siteName;
  const footerQuickTitle = values.footerQuickTitle?.trim() || "دسترسی سریع";
  const footerOfficeTitle =
    values.footerOfficeTitle?.trim() || `دفتر ${siteName}`;
  const footerCopyright =
    values.footerCopyright?.trim() ||
    `© ${new Date().getFullYear().toLocaleString("fa-IR")} ${siteName}. تمامی حقوق محفوظ است.`;

  const isCommerceLink = (href: string) => /^\/(?:cart|payment)\/?(?:[?#]|$)/.test(href);
  const isTravelServiceLink = (href: string) => {
    const [pathname, query] = href.split("#", 1)[0].split("?", 2);
    return /^\/(?:hotels|services\/(?:flights|hotels|buses|trains))\/?$/.test(pathname) ||
      (/^\/services\/?$/.test(pathname) && ["flight", "hotel", "bus", "train", "visa"].includes(new URLSearchParams(query).get("type") ?? ""));
  };
  const quickLinks = siteConfig.footerLinks
    .map((item, index) => ({
      id: `footer-quick-${index + 1}`,
      label: values[`footerQuick${index + 1}Label`]?.trim() || item.label,
      href: safeInternalHref(values[`footerQuick${index + 1}Url`], item.href),
    }))
    .filter((item) => item.href !== siteConfig.contactHref && !isCommerceLink(item.href) && !isTravelServiceLink(item.href))
    .filter((item, index, items) =>
      items.findIndex(
        (candidate) => candidate.href === item.href || candidate.label === item.label,
      ) === index,
    );
  const licenses = [1, 2, 3]
    .map((number) => ({
      title: values[`license${number}Title`]?.trim() || "",
      url: safeExternalHref(values[`license${number}Url`], ""),
    }))
    .filter((license) => license.title && license.url);
  const socialLinks = socialOrder.map((icon) => {
    const fallback = siteConfig.socialLinks.find((item) => item.icon === icon);
    return {
      icon,
      label: fallback?.label ?? icon,
      href: safeExternalHref(values[icon], fallback?.href ?? "#"),
    };
  });

  return (
    <footer
      dir="rtl"
      className={`${styles.footer} site-footer mt-auto text-right`}
    >
      <div className={styles.layout}>

        <Container className={styles.main}>
          <section aria-labelledby="footer-brand-title" className="min-w-0">
            <Link
              href="/"
              className="group flex w-fit items-center gap-2 rounded-xl"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-transparent transition-transform group-hover:-translate-y-1">
                <BrandLogo decorative className="h-full w-full object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,.16)]" />
              </span>
              <span>
                <strong
                  id="footer-brand-title"
                  className="block text-base leading-tight font-black text-white"
                >
                  {footerBrandTitle}
                </strong>
                <span className="mt-0.5 block text-xs leading-tight text-white/75">
                  {siteConfig.description}
                </span>
              </span>
            </Link>
            <div className="mt-2 grid max-w-64 grid-cols-4 gap-1.5" aria-label="پیوندهای سازمان‌های هواپیمایی و اینماد">
              <EnamadSeal compact />
              {[
                { name: "انجمن بین‌المللی حمل‌ونقل هوایی (IATA)", href: "https://www.iata.org/", image: "/images/organizations/iata.svg" },
                { name: "سازمان هواپیمایی کشوری", href: "https://www.caa.gov.ir/", image: "/images/organizations/caa.png" },
                { name: "انجمن شرکت‌های هواپیمایی ایران", href: "https://www.aira.ir/members", image: "/images/organizations/aira.jpg" },
              ].map((organization) => (
                <a
                  key={organization.href}
                  href={organization.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={organization.name + " (باز شدن در تب جدید)"}
                  title={organization.name}
                  className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={organization.image} alt={organization.name} width={100} height={64} className={organization.image.endsWith("caa.png") ? "max-h-8 w-full object-contain brightness-0 opacity-80" : "max-h-8 w-full object-contain"} />
                </a>
              ))}
            </div>
            {licenses.length ? (
              <div className="mt-2">
                <h2 className="text-xs font-black text-white">مجوزها و استعلام رسمی</h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {licenses.map((license) => (
                    <a
                      className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white/80 transition hover:border-accent hover:text-white"
                      href={license.url}
                      key={license.title}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {license.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <nav aria-label={footerQuickTitle} className={styles.column}>
            <h2 className="font-black text-white">{footerQuickTitle}</h2>
            <ul className={`${styles.links} mt-1.5 grid gap-x-2 gap-y-1 text-white/70`}>
              {quickLinks.map((item) => (
                <li key={item.id}>
                  <Link
                    className="inline-flex items-center gap-1.5 transition hover:-translate-x-1 hover:text-white"
                    href={item.href}
                  >
                    <span className="text-[#f079b0]" aria-hidden="true">←</span>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className={styles.installItem}>
                <Link href="/install/" className="inline-flex min-h-7 items-center gap-1.5 font-bold text-white">
                  <span aria-hidden="true">↓</span>نصب وب‌اپ جهان باستان
                </Link>
              </li>
            </ul>
          </nav>

          <section aria-labelledby="footer-office-title" className={styles.column}>
            <h2 id="footer-office-title" className="font-black text-white">
              {footerOfficeTitle}
            </h2>
            <address className="mt-1.5 grid gap-1 not-italic text-white/70">
              <span className="flex items-start gap-1.5">
                <LocationIcon className="size-4 shrink-0 text-white" />
                <span>{address}</span>
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <PhoneIcon className="size-4 shrink-0 text-white" />
                  <span dir="ltr">{toPersianDigits(phone)}</span>
                </a>
                <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-white">
                  <MailIcon className="size-4 shrink-0 text-white" />
                  <span dir="ltr" className="[overflow-wrap:anywhere]">{email}</span>
                </a>
              </div>
              <span className="inline-flex items-start gap-1.5 text-white/70">
                <ClockIcon className="size-4 shrink-0 text-white" />
                {workingHours}
              </span>
            </address>
          </section>
        </Container>

        <div className="footer-bottom border-t border-white/15 bg-[#031d55]/65">
          <Container className="flex flex-col gap-2 py-2 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p>{footerCopyright}</p>
              <nav aria-label="پیوندهای حقوقی" className="flex flex-wrap gap-x-1.5 gap-y-1 sm:gap-x-3">
                <Link className="text-white/75 underline-offset-4 hover:text-white hover:underline" href="/terms/">شرایط استفاده و خرید</Link>
                <Link className="text-white/75 underline-offset-4 hover:text-white hover:underline" href="/privacy/">حریم خصوصی</Link>
              </nav>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1" aria-label="شبکه‌های اجتماعی">
              {socialLinks.map((social) => {
                const SocialIcon = socialIcons[social.icon];
                return (
                  <a
                    key={social.icon}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="grid size-9 place-items-center rounded-full border border-white/25 text-white transition duration-200 hover:-translate-y-1 hover:border-[#ef70ac] hover:bg-[#ef70ac] hover:text-brand"
                  >
                    <SocialIcon className="size-4" />
                  </a>
                );
              })}
            </div>
          </Container>
        </div>
      </div>
    </footer>
  );
}
