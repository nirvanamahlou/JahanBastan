"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type PasswordResetResponse = {
  message?: string;
  resetUrl?: string;
};

export function PasswordResetRequestForm() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setResetUrl("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `${PUBLIC_API_BASE_URL}/account/password-reset/request`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      },
    ).catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      setError("ارسال درخواست بازیابی ممکن نشد. چند دقیقه بعد دوباره تلاش کنید.");
      return;
    }

    const data = (await response.json()) as PasswordResetResponse;
    setNotice(
      data.message ||
        "اگر این ایمیل در سایت ثبت شده باشد، لینک بازیابی برای آن ارسال شده است.",
    );
    setResetUrl(data.resetUrl || "");
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <Input
        autoComplete="email"
        id="password-reset-email"
        label="ایمیل حساب کاربری"
        name="email"
        placeholder="name@example.com"
        required
        type="email"
      />
      <p className="rounded-xl bg-brand-soft px-4 py-3 text-xs leading-6 text-muted">
        لینک بازیابی فقط یک‌بار قابل استفاده است و پس از ۳۰ دقیقه منقضی می‌شود.
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {resetUrl ? (
        <Link
          className="block rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-center text-sm font-black text-pink-700 hover:bg-pink-100"
          href={resetUrl}
        >
          ادامهٔ بازیابی رمز در محیط محلی
        </Link>
      ) : null}
      <Button
        className="w-full bg-pink-500 text-white hover:bg-pink-600 focus-visible:ring-pink-500"
        loading={submitting}
        size="lg"
        type="submit"
      >
        ارسال لینک بازیابی
      </Button>
      <Link className="block text-center text-sm font-bold text-brand hover:underline" href="/account/">
        بازگشت به ورود
      </Link>
    </form>
  );
}