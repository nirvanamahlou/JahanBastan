"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { adminClientFetch } from "@/lib/admin-client";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MfaStatus = { enabled: boolean; required: boolean };
type Setup = { secret: string; provisioningUri: string };

export function AdminSecurityPanel({ username }: { username: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    adminClientFetch("/auth/mfa", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setStatus((await response.json()) as MfaStatus);
      })
      .catch(() => setError("دریافت وضعیت ورود دومرحله‌ای ناموفق بود."));
  }, []);

  async function beginSetup() {
    setBusy(true);
    setError("");
    const response = await adminClientFetch("/auth/mfa/setup", {
      method: "POST",
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setBusy(false);
    if (!response?.ok) {
      setError(payload?.detail ?? "شروع فعال‌سازی ناموفق بود.");
      return;
    }
    setSetup(payload as Setup);
  }

  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await adminClientFetch("/auth/mfa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: data.get("code") }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("کد صحیح نیست یا زمان آن گذشته است.");
      return;
    }
    setStatus({ enabled: true, required: status?.required ?? false });
    setSetup(null);
    setMessage("ورود دومرحله‌ای با موفقیت فعال شد.");
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("ورود دومرحله‌ای غیرفعال شود؟ همه نشست‌های مدیریت بسته می‌شوند.")) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await adminClientFetch("/auth/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: data.get("password"),
        code: data.get("code"),
      }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("رمز عبور یا کد یک‌بارمصرف صحیح نیست.");
      return;
    }
    router.push("/admin/login/");
    router.refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    const passwordConfirmation = String(data.get("passwordConfirmation") ?? "");
    if (newPassword !== passwordConfirmation) {
      setError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }

    setChangingPassword(true);
    const response = await adminClientFetch("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(data.get("email") ?? "").trim(),
        currentPassword: data.get("currentPassword"),
        newPassword,
      }),
    }).catch(() => null);
    setChangingPassword(false);

    if (!response?.ok) {
      setError(
        response?.status === 401
          ? "نام کاربری یا رمز عبور فعلی صحیح نیست."
          : response?.status === 422
            ? "رمز جدید باید حداقل ۱۲ کاراکتر باشد و با رمز فعلی تفاوت داشته باشد."
            : "تغییر رمز عبور انجام نشد. دوباره تلاش کنید.",
      );
      return;
    }

    router.push("/admin/login/?passwordChanged=1");
    router.refresh();
  }

  return (
    <section className="admin-panel mx-auto max-w-3xl space-y-5 p-5 sm:p-8">
      <div>
        <p className="text-sm font-bold text-accent">امنیت حساب مدیریت</p>
        <h1 className="mt-2 text-2xl font-black text-primary">ورود دومرحله‌ای</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          کد یک‌بارمصرف برنامه‌هایی مثل Google Authenticator یا Microsoft Authenticator را
          به رمز عبور اضافه کنید.
        </p>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}
      <form
        className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6"
        onSubmit={changePassword}
      >
        <div>
          <h2 className="text-lg font-black text-primary">تغییر رمز عبور</h2>
          <p className="mt-1 text-sm leading-7 text-muted">
            بدون ارسال ایمیل یا اتصال به سرویس بیرونی، نام کاربری و رمز فعلی را
            تأیید کنید و رمز جدید بسازید.
          </p>
        </div>
        <Input
          id="admin-change-password-email"
          name="email"
          label="نام کاربری (ایمیل)"
          type="email"
          defaultValue={username}
          autoComplete="username"
          required
        />
        <Input
          id="admin-change-password-current"
          name="currentPassword"
          label="رمز عبور فعلی"
          type="password"
          minLength={12}
          autoComplete="current-password"
          required
        />
        <Input
          id="admin-change-password-new"
          name="newPassword"
          label="رمز عبور جدید"
          type="password"
          minLength={12}
          autoComplete="new-password"
          hint="حداقل ۱۲ کاراکتر"
          required
        />
        <Input
          id="admin-change-password-confirmation"
          name="passwordConfirmation"
          label="تکرار رمز عبور جدید"
          type="password"
          minLength={12}
          autoComplete="new-password"
          required
        />
        <Button loading={changingPassword} type="submit">
          ثبت رمز جدید و خروج از همه نشست‌ها
        </Button>
      </form>
      {status?.enabled ? (
        <form className="space-y-4" onSubmit={disable}>
          <Alert variant="success">ورود دومرحله‌ای برای حساب شما فعال است.</Alert>
          <Input id="mfa-disable-password" name="password" label="رمز عبور فعلی" type="password" minLength={12} required />
          <Input id="mfa-disable-code" name="code" label="کد ۶ رقمی فعلی" inputMode="numeric" pattern="[0-9]{6}" required />
          <Button loading={busy} variant="ghost" type="submit">غیرفعال‌کردن و خروج از همه نشست‌ها</Button>
        </form>
      ) : setup ? (
        <form className="space-y-4" onSubmit={enable}>
          <Alert variant="info">
            این کلید را فقط یک‌بار داخل Authenticator وارد کنید و در اختیار کسی نگذارید.
          </Alert>
          <div dir="ltr" className="break-all rounded-2xl bg-surface-muted p-4 font-mono text-sm">
            {setup.secret}
          </div>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">نمایش لینک تنظیم دستی</summary>
            <p dir="ltr" className="mt-2 break-all">{setup.provisioningUri}</p>
          </details>
          <Input id="mfa-enable-code" name="code" label="کد ۶ رقمی برنامه" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required />
          <Button loading={busy} type="submit">تأیید و فعال‌سازی</Button>
        </form>
      ) : (
        <Button loading={busy} onClick={beginSetup}>شروع فعال‌سازی امن</Button>
      )}
    </section>
  );
}
