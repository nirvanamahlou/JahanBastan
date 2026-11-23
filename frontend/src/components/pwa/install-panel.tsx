"use client";

import { usePwa } from "./pwa-provider";

export function InstallPanel() {
  const { installed, canInstall, installing, message, waiting, install, update } = usePwa();
  return <div className="grid min-w-0 gap-6">
    <section className="rounded-2xl border border-border bg-white p-5 text-brand sm:p-8" aria-labelledby="install-title">
      <h1 id="install-title" className="text-2xl font-black">جهان باستان روی گوشی شما</h1>
      <p className="mt-3 leading-8">با افزودن جهان باستان به صفحه اصلی، تورها و خدمات سفر را از آیکون برنامه باز کنید.</p>
      {installed ? <p className="mt-4 font-bold" role="status">جهان باستان در حالت برنامه باز است.</p> : canInstall ?
        <button type="button" disabled={installing} onClick={() => void install()} className="mt-5 min-h-12 w-full rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-60 sm:w-auto">{installing ? "در حال نصب…" : "نصب جهان باستان"}</button> :
        <p className="mt-4 text-sm leading-7">اگر دکمه نصب نمایش داده نشد، از راهنمای مرورگر خود در پایین استفاده کنید.</p>}
      <p role="status" aria-live="polite" className="mt-3 text-sm leading-7">{message}</p>
      {waiting ? <div className="mt-4 rounded-xl border border-border p-4"><p className="text-sm leading-7">نسخه جدید آماده است. پس از ذخیره اطلاعات و اتمام رزرو یا پرداخت، به‌روزرسانی کنید؛ صفحه اصلی باز می‌شود.</p><button type="button" onClick={update} className="mt-3 min-h-12 rounded-xl bg-brand px-5 text-white">به‌روزرسانی و بازکردن صفحه اصلی</button></div> : null}
    </section>
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-border bg-white p-5 sm:p-8" aria-labelledby="ios-install">
        <h2 id="ios-install" className="text-xl font-bold text-brand">نصب روی آیفون و آیپد</h2>
        <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-8">
          <li>همین سایت را در Safari باز کنید.</li>
          <li>منوی اشتراک‌گذاری <span lang="en" dir="ltr">Share</span> را باز کنید.</li>
          <li>گزینه «افزودن به صفحه اصلی» <span lang="en" dir="ltr">Add to Home Screen</span> را انتخاب کنید.</li>
          <li>اگر «بازکردن به‌عنوان وب‌اپ» <span lang="en" dir="ltr">Open as Web App</span> نمایش داده شد، آن را روشن کنید و «افزودن» را بزنید.</li>
        </ol>
      </section>
      <section className="min-w-0 rounded-2xl border border-border bg-white p-5 sm:p-8" aria-labelledby="android-install">
        <h2 id="android-install" className="text-xl font-bold text-brand">نصب روی اندروید و رایانه</h2>
        <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-8">
          <li>سایت را در Chrome یا Edge باز کنید.</li>
          <li>دکمه «نصب جهان باستان» را بزنید یا از منوی مرورگر، «نصب برنامه» یا «افزودن به صفحه اصلی» را انتخاب کنید.</li>
          <li>نصب را تأیید کنید؛ سپس برنامه را از آیکون جهان باستان باز کنید.</li>
        </ol>
        <p className="mt-4 text-sm leading-7">در مرورگر داخلی پیام‌رسان‌ها ممکن است نصب در دسترس نباشد؛ لینک را در مرورگر اصلی گوشی باز کنید.</p>
      </section>
    </div>
    <p className="text-sm leading-8 text-muted">برای دیدن قیمت و ظرفیت به‌روز، ورود به حساب، رزرو و پرداخت به اینترنت نیاز دارید. اطلاعات سفر و سفارش‌های شما از همین حساب کاربری مدیریت می‌شود.</p>
  </div>;
}
