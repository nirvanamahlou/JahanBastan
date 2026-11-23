import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "حریم خصوصی | جهان باستان",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <Container className="py-12 sm:py-16" dir="rtl">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_50px_rgba(1,37,105,.08)] sm:p-10">
        <p className="text-sm font-black text-accent-strong">حقوق و امنیت کاربران</p>
        <h1 className="mt-2 text-3xl font-black text-brand">سیاست حفظ حریم خصوصی</h1>
        <div className="mt-8 space-y-7 text-sm leading-8 text-muted sm:text-base">
          <section><h2 className="text-xl font-black text-brand">آمار بازدید سایت</h2><p className="mt-2">برای شناخت صفحات پربازدید و منابع ورود، از Google Analytics استفاده می‌کنیم. این سرویس با کوکی‌ها و شناسه‌های مرورگر، آمار بازدید صفحات عمومی را پردازش می‌کند. اطلاعات فرم‌ها، مدارک مسافران و صفحات حساب، مدیریت و پرداخت در این اتصال ارسال نمی‌شوند. برای آشنایی با شیوه پردازش داده‌ها، <a className="underline" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">راهنمای حریم خصوصی گوگل</a> را ببینید.</p></section>
          <section><h2 className="text-xl font-black text-brand">اطلاعاتی که دریافت می‌کنیم</h2><p className="mt-2">اطلاعات حساب، تماس، مسافران، مدارک لازم برای صدور خدمات و سوابق سفارش فقط برای ارائه خدمات سفر، پشتیبانی، الزامات قانونی و جلوگیری از تقلب پردازش می‌شوند.</p></section>
          <section><h2 className="text-xl font-black text-brand">اطلاعات حساس مسافر</h2><p className="mt-2">کد ملی، شماره و تاریخ انقضای گذرنامه و تاریخ تولد در پایگاه داده محافظت‌شده نگهداری می‌شوند و در حافظه دائمی مرورگر ذخیره نمی‌شوند. دسترسی کارکنان به اندازه نیاز شغلی محدود می‌شود.</p></section>
          <section><h2 className="text-xl font-black text-brand">اشتراک‌گذاری</h2><p className="mt-2">اطلاعات تنها در حد لازم با شرکت هواپیمایی، هتل، بیمه، تأمین‌کننده خدمت، درگاه پرداخت و مراجع قانونی به اشتراک گذاشته می‌شود و برای فروش تبلیغاتی واگذار نمی‌شود.</p></section>
          <section><h2 className="text-xl font-black text-brand">حقوق شما</h2><p className="mt-2">برای مشاهده، اصلاح یا درخواست حذف اطلاعات قابل حذف می‌توانید از بخش پشتیبانی حساب یا صفحه تماس با ما درخواست ثبت کنید. برخی سوابق مالی و قراردادی باید مطابق قانون نگهداری شوند.</p></section>
          <section><h2 className="text-xl font-black text-brand">امنیت و نگهداری</h2><p className="mt-2">ارتباطات در محیط عملیاتی با HTTPS انجام می‌شود. نشست ورود در کوکی HttpOnly نگهداری می‌شود و اطلاعات فقط به مدت لازم برای قرارداد، پشتیبانی و تکالیف قانونی حفظ می‌شوند.</p></section>
        </div>
        <div className="mt-9 flex flex-wrap gap-3"><Link className="rounded-xl bg-brand px-5 py-3 font-black text-white" href="/contact/">تماس با مسئول حریم خصوصی</Link><Link className="rounded-xl border border-border px-5 py-3 font-black text-brand" href="/terms/">مشاهده شرایط استفاده و خرید</Link></div>
      </article>
    </Container>
  );
}
