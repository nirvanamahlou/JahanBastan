import type { Metadata } from "next";
import Image from "next/image";

import { RichText } from "@/components/content/rich-text";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "درباره ما",
  alternates: { canonical: "/about/" },
};

type PublicSettings = {
  siteName: string;
  socialLinks: Record<string, string>;
};

const fallback = {
  eyebrow: "درباره جهان باستان",
  title: "همراه شما برای تجربه‌ای مطمئن از سفر",
  intro:
    "جهان باستان با شناخت مقصد، برنامه‌ریزی دقیق و پشتیبانی انسانی، مسیر سفر را برای شما روشن و قابل اعتماد می‌کند.",
  storyTitle: "داستان ما",
  storyBody:
    "ما سفر را فقط رزرو نمی‌کنیم؛ تجربه‌ای هماهنگ از انتخاب مقصد تا بازگشت می‌سازیم.",
  valuesTitle: "ارزش‌های ما",
  valuesBody:
    "شفافیت، پاسخ‌گویی، انتخاب آگاهانه و احترام به زمان و بودجه مسافر، پایه تصمیم‌های ما هستند.",
  trustTitle: "اعتماد و اعتبار",
  trustBody:
    "اطلاعات روشن، خدمات بررسی‌شده و پشتیبانی پیش و حین سفر، تعهد ما به یک تجربه مطمئن است.",
  ctaLabel: "مشاهده تورها",
  ctaHref: "/tours/",
};

function readValue(
  values: Record<string, string>,
  key: string,
  defaultValue: string,
): string {
  return values[key]?.trim() || defaultValue;
}

export default async function AboutPage() {
  const settings = await apiGet<PublicSettings>("/settings", {
    cache: "no-store",
  }).catch(() => null);
  const values = settings?.socialLinks ?? {};
  const imageId = Number(values.aboutImageId);
  const sections = [
    {
      title: readValue(values, "aboutStoryTitle", fallback.storyTitle),
      body: readValue(values, "aboutStoryBody", fallback.storyBody),
    },
    {
      title: readValue(values, "aboutValuesTitle", fallback.valuesTitle),
      body: readValue(values, "aboutValuesBody", fallback.valuesBody),
    },
    {
      title: readValue(values, "aboutTrustTitle", fallback.trustTitle),
      body: readValue(values, "aboutTrustBody", fallback.trustBody),
    },
  ];

  return (
    <main>
      <section className="border-b border-border bg-surface-muted py-12 sm:py-16">
        <Container className="grid items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-sm font-black text-brand">
              {readValue(values, "aboutEyebrow", fallback.eyebrow)}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-brand sm:text-5xl">
              {readValue(values, "aboutTitle", fallback.title)}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted sm:text-lg">
              {readValue(values, "aboutIntro", fallback.intro)}
            </p>
            <ButtonLink
              className="mt-7"
              href={readValue(values, "aboutCtaHref", fallback.ctaHref)}
            >
              {readValue(values, "aboutCtaLabel", fallback.ctaLabel)}
            </ButtonLink>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-brand">
            {Number.isInteger(imageId) && imageId > 0 ? (
              <Image
                alt={`درباره ${settings?.siteName ?? "جهان باستان"}`}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                src={`${PUBLIC_API_BASE_URL}/media/${imageId}`}
              />
            ) : (
              <div className="grid h-full place-items-center px-8 text-center text-white">
                <p className="max-w-sm text-2xl font-black leading-10">
                  سفرهای به‌یادماندنی با انتخاب آگاهانه آغاز می‌شوند.
                </p>
              </div>
            )}
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16" aria-labelledby="about-sections-title">
        <Container>
          <h2 id="about-sections-title" className="sr-only">
            داستان، ارزش‌ها و اعتبار ما
          </h2>
          <div className="grid gap-5 lg:grid-cols-3">
            {sections.map((section) => (
              <Card className="h-full p-6 sm:p-7" key={section.title}>
                <h3 className="text-xl font-black text-brand">{section.title}</h3>
                <RichText
                  className="mt-4 text-sm leading-8 text-muted"
                  content={section.body}
                />
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
