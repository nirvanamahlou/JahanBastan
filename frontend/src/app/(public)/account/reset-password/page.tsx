import type { Metadata } from "next";

import { PasswordResetConfirmForm } from "@/components/password-reset-confirm-form";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "تعیین رمز عبور جدید",
  description: "رمز عبور جدید حساب جهان باستان را تعیین کنید.",
};

export default function ResetPasswordPage() {
  return (
    <section className="min-h-[calc(100vh-12rem)] bg-[radial-gradient(circle_at_top,_#e8f2ff_0,_transparent_38%),linear-gradient(180deg,#f9fbff_0%,#ffffff_100%)] py-10 sm:py-16">
      <Container className="max-w-xl">
        <div className="rounded-[2rem] border border-brand/10 bg-white p-6 shadow-[0_24px_70px_rgba(1,37,105,0.13)] sm:p-9" dir="rtl">
          <h1 className="text-2xl font-black text-brand sm:text-3xl">رمز عبور جدید</h1>
          <p className="mt-3 text-sm leading-7 text-muted">رمز جدید باید دست‌کم ۸ کاراکتر داشته باشد.</p>
          <PasswordResetConfirmForm />
        </div>
      </Container>
    </section>
  );
}