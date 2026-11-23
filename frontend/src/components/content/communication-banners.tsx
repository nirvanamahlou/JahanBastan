import Image from "next/image";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { communicationBannerHref, communicationChannels } from "@/lib/communication-banners";

export function CommunicationBanners({ links }: { links: Record<string, string> }) {
  const banners = communicationChannels.flatMap(({ key, label }) => {
    const imageId = Number(links[`${key}BannerImageId`]);
    const href = communicationBannerHref(links[`${key}BannerHref`] ?? links[key]);
    if (!Number.isInteger(imageId) || imageId <= 0 || !href) return [];
    return [{ key, imageId, href, title: links[`${key}BannerTitle`]?.trim() || label }];
  });
  if (!banners.length) return null;

  return (
    <section aria-label="راه‌های ارتباط با جهان باستان" className="grid w-full grid-cols-4 gap-2 py-2 sm:gap-4">
      {banners.map((banner) => (
        <a key={banner.key} href={banner.href} target="_blank" rel="noopener noreferrer" className="relative block aspect-square min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent">
          <Image src={`${PUBLIC_API_BASE_URL}/media/${banner.imageId}`} alt={banner.title} fill sizes="(max-width: 1440px) 25vw, 360px" className="object-cover" />
        </a>
      ))}
    </section>
  );
}
