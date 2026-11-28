import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { InstallPanel } from "@/components/pwa/install-panel";

export const metadata: Metadata = {
  title: "نصب وب‌اپ جهان باستان",
  description: "نصب جهان باستان روی گوشی اندروید، آیفون و رایانه و راهنمای افزودن به صفحه اصلی.",
};

export default function InstallPage() {
  return <Container className="py-5 [--container-max:54rem] sm:py-7">
    <Image src="/pwa/icon-192.png" width={64} height={64} alt="نشان جهان باستان" className="mx-auto mb-3 rounded-xl" />
    <InstallPanel />
  </Container>;
}
