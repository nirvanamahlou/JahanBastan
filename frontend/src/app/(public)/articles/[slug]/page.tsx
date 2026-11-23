import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/layout/page-intro";
import { RichText } from "@/components/content/rich-text";
import { Container } from "@/components/ui/container";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatPersianDate } from "@/lib/persian-date";

type Props = { params: Promise<{ slug: string }> };
type Article = { title: string; category: string; excerpt: string; body: string; authorName: string; imageId: number | null; galleryImageIds: number[]; metaTitle: string | null; metaDescription: string | null; publishedAt: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const item = await apiGet<Article>(`/articles/${slug}`, { cache: "no-store" }).catch(() => null);
  const title = item?.metaTitle ?? item?.title ?? "مقاله";
  const description = item?.metaDescription ?? item?.excerpt;
  const images = item?.imageId ? [`${PUBLIC_API_BASE_URL}/media/${item.imageId}`] : [];
  return {
    title,
    description,
    alternates: { canonical: `/articles/${slug}/` },
    openGraph: { title, description, type: "article", url: `/articles/${slug}/`, publishedTime: item?.publishedAt, authors: item?.authorName ? [item.authorName] : undefined, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params; const item = await apiGet<Article>(`/articles/${slug}`, { cache: "no-store" }).catch(() => null); if (!item) notFound();
  const galleryImageIds = item.galleryImageIds.filter((id) => id !== item.imageId);
  return (
    <>
      <PageIntro eyebrow={item.category} title={item.title} description={item.excerpt} />
      <Container className="max-w-4xl py-10 sm:py-12">
        {galleryImageIds.length ? (
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galleryImageIds.map((id, index) => (
              <div className="relative aspect-square overflow-hidden rounded-2xl" key={id}>
                <Image
                  alt={`${item.title}، تصویر گالری ${index + 1}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  src={`${PUBLIC_API_BASE_URL}/media/${id}`}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap gap-4 text-sm font-bold text-brand">
          <span>نویسنده: {item.authorName}</span>
          <time dateTime={item.publishedAt}>{formatPersianDate(item.publishedAt)}</time>
        </div>

        <article className="rounded-3xl border border-border bg-surface p-5 shadow-[0_18px_45px_rgba(1,37,105,0.08)] sm:p-8" dir="rtl">
          <div className="mb-6 border-b border-border pb-4">
            <h2 className="text-xl font-black text-brand sm:text-2xl">متن مقاله</h2>
          </div>
          {item.body.trim() ? (
            <RichText
              className="text-base text-foreground [&_p]:text-foreground [&_p]:sm:text-[1.05rem] [&_p]:leading-9"
              content={item.body}
            />
          ) : (
            <p className="leading-8 text-muted">متن این مقاله هنوز منتشر نشده است.</p>
          )}
        </article>
      </Container>
    </>
  );
}
