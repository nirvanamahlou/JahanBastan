import type { Metadata } from "next";

import { AccountDashboard } from "@/components/account-dashboard";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "حساب کاربری",
  description: "ورود، ثبت‌نام و مدیریت حساب کاربری در جهان باستان.",
};

export default function AccountPage() {
  return (
    <section className="min-h-[calc(100vh-12rem)] bg-[radial-gradient(circle_at_top,_#e8f2ff_0,_transparent_38%),linear-gradient(180deg,#f9fbff_0%,#ffffff_100%)] py-10 sm:py-16">
      <Container className="max-w-7xl">
        <AccountDashboard />
      </Container>
    </section>
  );
}