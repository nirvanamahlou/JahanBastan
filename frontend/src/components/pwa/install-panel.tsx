"use client";

import { usePwa } from "./pwa-provider";

export function InstallPanel() {
  const { installed, canInstall, installing, message, waiting, install, update } = usePwa();
  return <div className="grid min-w-0 gap-3 sm:gap-4">
    <section className="rounded-xl border border-border bg-white p-3 text-brand sm:p-4" aria-labelledby="install-title">
      <h1 id="install-title" className="text-lg font-black sm:text-xl">جهان باستان روی گوشی شما</h1>
      <p className="mt-1.5 text-sm leading-relaxed">با افزودن جهان باستان به صفحه اصلی، تورها و خدمات سفر را از آیکون برنامه باز کنید.</p>
      {installed ? <p className="mt-2 text-sm font-bold" role="status">جهان باستان در حالت برنامه باز است.</p> : canInstall ?
        <button type="button" disabled={installing} onClick={() => void install()} className="mt-2 min-h-10 w-full rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60 sm:w-auto">{installing ? "در حال نصب…" : "نصب جهان باستان"}</button> :
        <p className="mt-2 text-sm leading-relaxed">اگر دکمه نصب نمایش داده نشد، از راهنمای مرورگر خود در پایین استفاده کنید.</p>}
      <p role="status" aria-live="polite" className="mt-1 text-sm leading-relaxed empty:hidden">{message}</p>
      {waiting ? <div className="mt-2 rounded-lg border border-border p-2.5"><p className="text-sm leading-relaxed">نسخه جدید آماده است. پس از ذخیره اطلاعات و اتمام رزرو یا پرداخت، به‌روزرسانی کنید؛ صفحه اصلی باز می‌شود.</p><button type="button" onClick={update} className="mt-2 min-h-10 rounded-lg bg-brand px-3 py-1 text-sm text-white">به‌روزرسانی و بازکردن صفحه اصلی</button></div> : null}
    </section>
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-border bg-white p-3 sm:p-4" aria-labelledby="ios-install">
        <h2 id="ios-install" className="text-base font-bold text-brand">نصب روی آیفون و آیپد</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm leading-relaxed">
          <li>همین سایت را در Safari باز کنید.</li>
          <li>منوی اشتراک‌گذاری <span lang="en" dir="ltr">Share</span> را باز کنید.</li>
          <li>گزینه «افزودن به صفحه اصلی» <span lang="en" dir="ltr">Add to Home Screen</span> را انتخاب کنید.</li>
          <li>اگر «بازکردن به‌عنوان وب‌اپ» <span lang="en" dir="ltr">Open as Web App</span> نمایش داده شد، آن را روشن کنید و «افزودن» را بزنید.</li>
        </ol>
      </section>
      <section className="min-w-0 rounded-xl border border-border bg-white p-3 sm:p-4" aria-labelledby="android-install">
        <h2 id="android-install" className="text-base font-bold text-brand">نصب روی اندروید و رایانه</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm leading-relaxed">
          <li>سایت را در Chrome یا Edge باز کنید.</li>
          <li>دکمه «نصب جهان باستان» را بزنید یا از منوی مرورگر، «نصب برنامه» یا «افزودن به صفحه اصلی» را انتخاب کنید.</li>
          <li>نصب را تأیید کنید؛ سپس برنامه را از آیکون جهان باستان باز کنید.</li>
        </ol>
        <p className="mt-2 text-sm leading-relaxed">در مرورگر داخلی پیام‌رسان‌ها ممکن است نصب در دسترس نباشد؛ لینک را در مرورگر اصلی گوشی باز کنید.</p>
      </section>
    </div>
    <p className="text-xs leading-relaxed text-muted">برای دیدن قیمت و ظرفیت به‌روز، ورود به حساب، رزرو و پرداخت به اینترنت نیاز دارید. اطلاعات سفر و سفارش‌های شما از همین حساب کاربری مدیریت می‌شود.</p>
  </div>;
}
