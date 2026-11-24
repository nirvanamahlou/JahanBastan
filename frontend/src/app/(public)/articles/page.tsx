import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import catalogStyles from "@/components/content/catalog-layout.module.css";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatPersianDate } from "@/lib/persian-date";

export const metadata: Metadata = {
  title: "مجله گردشگری",
  alternates: { canonical: "/articles/" },
};
type Article = {
  id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  authorName: string;
  imageId: number | null;
  publishedAt: string;
};
type ArticleCategory = { id: number; name: string; slug: string };

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [payload, categories] = await Promise.all([
    apiGet<{ items: Article[] }>(
      `/articles?pageSize=100${category ? `&category=${encodeURIComponent(category)}` : ""}`,
      { cache: "no-store" },
    ).catch(() => ({ items: [] })),
    apiGet<ArticleCategory[]>("/article-categories", {
      cache: "no-store",
    }).catch(() => []),
  ]);
  const [featured, ...articles] = payload.items;

  return (
    <>
      <PageIntro compact
        eyebrow="راهنما، تجربه و الهام"
        title="مجله سفر"
        description="راهنمای مقصد، تجربه‌های واقعی و نکات کاربردی برای سفرهای بهتر."
      />
      <section className="py-10 sm:py-14">
        <Container className={catalogStyles.catalogContainer}>
          {categories.length ? (
            <nav
              aria-label="فیلتر دسته‌بندی مقالات"
              className="mb-7 flex flex-wrap gap-2"
            >
              <Link
                className={`rounded-full border px-5 py-2 text-sm font-bold ${
                  !category
                    ? "border-accent bg-accent text-brand"
                    : "border-border bg-surface"
                }`}
                href="/articles/"
              >
                همه
              </Link>
              {categories.map((item) => (
                <Link
                  className={`rounded-full border px-5 py-2 text-sm font-bold ${
                    category === item.name
                      ? "border-accent bg-accent text-brand"
                      : "border-border bg-surface"
                  }`}
                  href={`/articles/?category=${encodeURIComponent(item.name)}`}
                  key={item.id}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          ) : null}

          {featured ? (
            <>
              <Card
                as="article"
                className="magazine-card magazine-featured group relative min-h-[26rem] overflow-hidden p-0 text-white"
              >
                {featured.imageId ? (
                  <Image
                    alt={featured.title}
                    className="object-cover transition duration-500 group-hover:scale-105"
                    fill
                    priority
                    sizes="100vw"
                    src={`${PUBLIC_API_BASE_URL}/media/${featured.imageId}`}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-l from-brand/90 via-brand/45 to-transparent" />
                <div className="relative flex min-h-[26rem] max-w-2xl flex-col justify-end p-7 sm:p-10">
                  <Badge variant="accent">{featured.category}</Badge>
                  <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 line-clamp-2 leading-8 text-white/80">
                    {featured.excerpt}
                  </p>
                  <time className="mt-3 text-sm text-white/70" dateTime={featured.publishedAt}>
                    {formatPersianDate(featured.publishedAt)}
                  </time>
                  <Link
                    className="magazine-card-link mt-6 w-fit rounded-xl bg-accent px-5 py-2 font-bold text-brand"
                    href={`/articles/${featured.slug}/`}
                  >
                    مطالعه مقاله
                  </Link>
                </div>
              </Card>

              {articles.length ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {articles.map((item) => (
                    <Card
                      as="article"
                      className="magazine-card group overflow-hidden p-0"
                      key={item.id}
                    >
                      <div className="magazine-media relative aspect-[4/3] bg-surface-muted">
                        {item.imageId ? (
                          <Image
                            alt={item.title}
                            className="object-cover transition duration-300 group-hover:scale-105"
                            fill
                            sizes="(max-width:640px) 100vw, 25vw"
                            src={`${PUBLIC_API_BASE_URL}/media/${item.imageId}`}
                          />
                        ) : null}
                        <Badge variant="accent" className="absolute right-3 top-3">
                          {item.category}
                        </Badge>
                      </div>
                      <div className="p-5">
                        <h2 className="line-clamp-2 text-lg font-black leading-7">
                          {item.title}
                        </h2>
                        <p className="mt-3 line-clamp-2 text-sm leading-7 text-muted">
                          {item.excerpt}
                        </p>
                        <time className="mt-3 block text-xs text-muted" dateTime={item.publishedAt}>
                          {formatPersianDate(item.publishedAt)}
                        </time>
                        <Link
                          className="magazine-card-link mt-4 inline-block text-sm font-bold text-brand"
                          href={`/articles/${item.slug}/`}
                        >
                          ادامه مطلب ←
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title={
                category
                  ? "مقاله‌ای در این دسته‌بندی نیست"
                  : "هنوز مقاله‌ای منتشر نشده است"
              }
              description={
                category
                  ? "دسته‌بندی دیگری را انتخاب کنید."
                  : "مقاله‌های منتشرشده از پنل مدیریت اینجا نمایش داده می‌شوند."
              }
            />
          )}
        </Container>
      </section>
    </>
  );
}
