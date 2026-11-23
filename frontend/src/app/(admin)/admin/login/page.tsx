import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { BrandLogo } from "@/components/layout/brand-logo";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export default async function AdminLoginPage() {
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (response.ok) {
      redirect("/admin");
    }
  }

  return (
    <section className="w-full max-w-[31rem] text-center" aria-labelledby="admin-login-title">
      <div className="mb-4 inline-flex flex-col items-center gap-2 rounded-2xl border border-white/75 bg-white/70 px-5 py-3 shadow-[0_12px_30px_rgba(1,37,105,0.12)] backdrop-blur-xl">
        <BrandLogo priority className="h-16 w-16 object-contain" />
        <span className="text-xs font-black text-brand">پنل مدیریت جهان باستان</span>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-surface/95 p-6 text-right shadow-[0_28px_80px_rgba(1,37,105,0.18)] backdrop-blur-xl sm:p-8">
        <div aria-hidden="true" className="absolute inset-x-12 top-0 h-px bg-gradient-to-l from-transparent via-accent-strong/65 to-transparent" />
        <div className="relative">
          <p className="mb-2 text-center text-xs font-bold text-accent-strong">دسترسی امن مدیران</p>
          <h1 id="admin-login-title" className="text-center text-2xl font-black text-brand sm:text-3xl">ورود به پنل مدیریت</h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-7 text-muted">
            ایمیل و رمز عبور حساب مدیر را وارد کنید.
          </p>
          <LoginForm />
        </div>
      </div>
    </section>
  );
}