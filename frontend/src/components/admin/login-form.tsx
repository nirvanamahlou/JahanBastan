"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { adminClientFetch } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";

type Screen = "login" | "request-reset" | "confirm-reset";

function passwordResetError(response: Response | null) {
  if (response?.status === 429) {
    return "تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره امتحان کنید.";
  }
  if (response?.status === 503) {
    return "سرویس ارسال ایمیل موقتاً در دسترس نیست. با پشتیبانی تماس بگیرید.";
  }
  return "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState<Screen>("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  function switchScreen(nextScreen: Screen) {
    setError("");
    setNotice("");
    setScreen(nextScreen);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await adminClientFetch("/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        mfaCode: String(form.get("mfaCode") ?? "").trim() || null,
      }),
    }).catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      setError(
        response?.status === 429
          ? "ورود موقتاً قفل شده است. کمی بعد دوباره تلاش کنید."
          : "ایمیل یا رمز عبور صحیح نیست.",
      );
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const response = await adminClientFetch("/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      setError(passwordResetError(response));
      return;
    }
    setResetEmail(email);
    setScreen("confirm-reset");
    setNotice("اگر این ایمیل به یک مدیر فعال تعلق داشته باشد، کد بازیابی برای آن ارسال شده است.");
  }

  async function handleResetConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
    if (password !== passwordConfirmation) {
      setError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }

    setSubmitting(true);
    const response = await adminClientFetch("/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        code: form.get("code"),
        password,
      }),
    }).catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      setError(
        response?.status === 400
          ? "کد واردشده نادرست است یا اعتبار آن تمام شده است."
          : passwordResetError(response),
      );
      return;
    }
    setScreen("login");
    setNotice("رمز عبور جدید ذخیره شد. اکنون با رمز جدید وارد شوید.");
  }

  if (screen === "request-reset") {
    return (
      <form className="mt-6 space-y-4" onSubmit={handleResetRequest}>
        <p className="text-sm leading-7 text-muted">
          ایمیل حساب مدیریتی را وارد کنید تا کد بازیابی ۶ رقمی برایتان ارسال شود.
        </p>
        <Input
          id="admin-reset-request-email"
          name="email"
          label="ایمیل مدیریتی"
          type="email"
          defaultValue={resetEmail}
          autoComplete="email"
          required
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="info">{notice}</Alert> : null}
        <Button className="w-full" loading={submitting} type="submit">
          ارسال کد بازیابی
        </Button>
        <Button className="w-full" variant="ghost" onClick={() => switchScreen("login")}>
          بازگشت به ورود
        </Button>
      </form>
    );
  }

  if (screen === "confirm-reset") {
    return (
      <form className="mt-6 space-y-4" onSubmit={handleResetConfirm}>
        <p className="text-sm leading-7 text-muted">
          کد ارسال‌شده به ایمیل و رمز جدید را وارد کنید. کد فقط برای مدت کوتاهی اعتبار دارد.
        </p>
        <Input
          id="admin-reset-confirm-email"
          name="email"
          label="ایمیل مدیریتی"
          type="email"
          defaultValue={resetEmail}
          autoComplete="email"
          readOnly
          required
        />
        <Input
          id="admin-reset-code"
          name="code"
          label="کد بازیابی"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          autoComplete="one-time-code"
          className="text-center tracking-[0.45em]"
          required
        />
        <Input
          id="admin-reset-password"
          name="password"
          label="رمز عبور جدید"
          type="password"
          minLength={12}
          autoComplete="new-password"
          hint="حداقل ۱۲ کاراکتر"
          required
        />
        <Input
          id="admin-reset-password-confirmation"
          name="passwordConfirmation"
          label="تکرار رمز عبور جدید"
          type="password"
          minLength={12}
          autoComplete="new-password"
          required
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="info">{notice}</Alert> : null}
        <Button className="w-full" loading={submitting} type="submit">
          ذخیره رمز جدید
        </Button>
        <Button className="w-full" variant="ghost" onClick={() => switchScreen("request-reset")}>
          ارسال دوباره کد
        </Button>
      </form>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleLogin}>
      {notice || searchParams.get("passwordChanged") === "1" ? (
        <Alert variant="success">
          {notice || "رمز عبور جدید ذخیره شد. اکنون با رمز جدید وارد شوید."}
        </Alert>
      ) : null}
      <Input
        id="admin-email"
        name="email"
        label="ایمیل"
        type="email"
        autoComplete="username"
        required
      />
      <Input
        id="admin-password"
        name="password"
        label="رمز عبور"
        type="password"
        minLength={12}
        autoComplete="current-password"
        required
      />
      <Input
        id="admin-mfa-code"
        name="mfaCode"
        label="کد ورود دومرحله‌ای (اگر فعال است)"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        minLength={6}
        maxLength={6}
        autoComplete="one-time-code"
        className="text-center tracking-[0.45em]"
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button className="w-full" loading={submitting} type="submit">
        ورود امن
      </Button>
      <Button className="w-full" variant="ghost" onClick={() => switchScreen("request-reset")}>
        رمز عبور را فراموش کرده‌اید؟
      </Button>
    </form>
  );
}
