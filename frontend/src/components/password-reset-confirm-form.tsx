"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

export function PasswordResetConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = searchParams.get("token") || "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("لینک بازیابی معتبر نیست یا ناقص است.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("passwordConfirmation") || "")) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }

    setSubmitting(true);
    const response = await fetch(
      `${PUBLIC_API_BASE_URL}/account/password-reset/confirm`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      },
    ).catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      setError("این لینک نامعتبر است یا زمان آن تمام شده. دوباره درخواست بازیابی بدهید.");
      return;
    }
    router.replace("/account/?passwordReset=success");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <Input
        autoComplete="new-password"
        id="new-password"
        label="رمز عبور جدید"
        maxLength={128}
        minLength={8}
        name="password"
        required
        type="password"
      />
      <Input
        autoComplete="new-password"
        id="new-password-confirmation"
        label="تکرار رمز عبور جدید"
        maxLength={128}
        minLength={8}
        name="passwordConfirmation"
        required
        type="password"
      />
      <p className="rounded-xl bg-brand-soft px-4 py-3 text-xs leading-6 text-muted">
        با ثبت رمز جدید، تمام نشست‌های قبلی حساب شما خارج می‌شوند.
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        className="w-full bg-pink-500 text-white hover:bg-pink-600 focus-visible:ring-pink-500"
        disabled={!token}
        loading={submitting}
        size="lg"
        type="submit"
      >
        ثبت رمز عبور جدید
      </Button>
      <Link className="block text-center text-sm font-bold text-brand hover:underline" href="/account/forgot-password/">
        درخواست لینک جدید
      </Link>
    </form>
  );
}