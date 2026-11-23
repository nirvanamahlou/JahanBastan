import type { Metadata } from "next";

import { ComparisonPage } from "@/components/content/comparison-page";

export const metadata: Metadata = {
  title: "مقایسهٔ هتل و تور",
  description: "مقایسهٔ گزینه‌های منتخب سفر در جهان باستان",
};

export default function ComparePage() {
  return <section className="bg-background px-4 py-10 sm:px-6 sm:py-14"><ComparisonPage /></section>;
}
