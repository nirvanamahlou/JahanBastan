import type { Metadata } from "next";

import { PageIntro } from "@/components/layout/page-intro";
import { Accordion } from "@/components/ui/accordion";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { apiGet } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "سوالات متداول",
  alternates: { canonical: "/faq/" },
};

type FAQ = {
  id: number;
  question: string;
  answer: string;
  category: string | null;
};

export default async function FaqPage() {
  const result = await apiGet<{ items: FAQ[] }>("/faqs?pageSize=100", {
    cache: "no-store",
  }).then((payload) => ({ payload, failed: false })).catch(() => ({
    payload: { items: [] as FAQ[] },
    failed: true,
  }));
  const questions = result.payload.items.map((item) => ({
    id: `faq-${item.id}`,
    title: item.question,
    content: item.answer,
  }));

  return (
    <>
      <PageIntro title="سوالات متداول" description="پاسخ پرسش‌های رایج درباره تورها، رزرو و خدمات سفر." />
      <section className="py-12 sm:py-16">
        <Container className="max-w-4xl">
          <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سوالات متداول" }]} />
          <div className="mt-7">
            {questions.length ? <Accordion items={questions} /> : (
              <EmptyState
                title={result.failed ? "دریافت سوالات ممکن نشد" : "هنوز سوالی منتشر نشده است"}
                description={result.failed ? "لطفاً چند دقیقه دیگر دوباره تلاش کنید." : "سوالات منتشرشده از پنل مدیریت در این بخش نمایش داده می‌شوند."}
              />
            )}
          </div>
          <div className="mt-8 rounded-2xl bg-surface-muted p-6 text-center">
            <h2 className="text-xl font-black">پاسخ خود را پیدا نکردید؟</h2>
            <p className="mt-2 text-sm text-muted">کارشناسان ما برای راهنمایی شما آماده‌اند.</p>
            <ButtonLink href="/contact/" className="mt-5">تماس با ما</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
