import type { Metadata } from "next";
import { TourCheckoutPageContent } from "@/components/checkout/tour-checkout-page-content";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "رزرو تور",
  robots: { index: false, follow: false },
};

export default async function TourCheckoutPage({ searchParams }: {
  searchParams: Promise<{ selection?: string | string[] }>;
}) {
  const { selection } = await searchParams;
  const selectionId = typeof selection === "string" && /^[0-9a-f-]{36}$/.test(selection) ? selection : null;

  return (
    <Container className="grid gap-4 py-5 [--container-max:60rem] sm:py-6" dir="rtl">
      <h1 className="text-xl font-black text-brand sm:text-2xl">رزرو تور</h1>
      <TourCheckoutPageContent selectionId={selectionId} />
    </Container>
  );
}
