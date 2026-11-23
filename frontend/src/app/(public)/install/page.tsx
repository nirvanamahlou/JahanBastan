import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { InstallPanel } from "@/components/pwa/install-panel";

export const metadata: Metadata = {
  title: "نصب وب‌اپ جهان باستان",
  description: "نصب جهان باستان روی گوشی اندروید، آیفون و رایانه و راهنمای افزودن به صفحه اصلی.",
};

export default function InstallPage() {
  return <Container className="max-w-4xl py-8 sm:py-12">
    <Image src="/pwa/icon-192.png" width={96} height={96} alt="نشان جهان باستان" className="mx-auto mb-6 rounded-2xl" />
    <InstallPanel />
  </Container>;
}
