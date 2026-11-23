import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { apiGet, PUBLIC_API_BASE_URL } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "راهنمای سفر",
  alternates: { canonical: "/travel-guide/" },
};
type Article = { id: number; title: string; slug: string; category: string; excerpt: string; imageId: number | null };

export default async function TravelGuidePage() {
  const payload = await apiGet<{ items: Article[] }>("/articles?pageSize=100").catch(() => ({ items: [] }));
  return <>
    <PageIntro title="راهنمای سفر" description="مقاله‌ها و راهنماهای کاربردی منتشرشده توسط تحریریه جهان باستان." />
    <section className="py-12 sm:py-16"><Container>
      {payload.items.length ? <ResponsiveGrid>{payload.items.map((article) => <Card as="article" key={article.id} className="magazine-card overflow-hidden p-0"><div className="magazine-media aspect-square bg-surface-muted bg-cover bg-center" style={article.imageId ? { backgroundImage: `url("${PUBLIC_API_BASE_URL}/media/${article.imageId}")` } : undefined} /><div className="p-5"><Badge variant="accent">{article.category}</Badge><h2 className="mt-4 text-xl font-black">{article.title}</h2><p className="mt-3 text-sm leading-7 text-muted">{article.excerpt}</p><Link className="magazine-card-link mt-5 inline-block font-bold text-brand" href={`/articles/${article.slug}/`}>مطالعه راهنما ←</Link></div></Card>)}</ResponsiveGrid> : <EmptyState title="هنوز راهنمایی منتشر نشده است" description="مقاله‌های منتشرشده از پنل مدیریت اینجا نمایش داده می‌شوند." />}
    </Container></section>
  </>;
}
