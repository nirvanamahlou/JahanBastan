import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "شرایط استفاده و خرید | جهان باستان",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  return (
    <Container className="py-12 sm:py-16" dir="rtl">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_50px_rgba(1,37,105,.08)] sm:p-10">
        <p className="text-sm font-black text-accent-strong">نسخه checkout-1405-01</p>
        <h1 className="mt-2 text-3xl font-black text-brand">شرایط استفاده، خرید و استرداد</h1>
        <div className="mt-8 space-y-7 text-sm leading-8 text-muted sm:text-base">
          <section><h2 className="text-xl font-black text-brand">قیمت و موجودی</h2><p className="mt-2">قیمت و ظرفیت تا زمان تأیید نهایی تأمین‌کننده قطعی نیست. مبلغ نهایی، ارز، خدمات انتخابی و مهلت پرداخت پیش از ثبت سفارش نمایش داده می‌شود.</p></section>
          <section><h2 className="text-xl font-black text-brand">اطلاعات مسافر</h2><p className="mt-2">مسئولیت تطابق نام، تاریخ تولد، کد ملی و گذرنامه با مدارک رسمی بر عهده خریدار است. گذرنامه با اعتبار کمتر از چهار ماه برای سفر خارجی پذیرفته نمی‌شود.</p></section>
          <section><h2 className="text-xl font-black text-brand">کنسلی و تغییر</h2><p className="mt-2">جریمه کنسلی و تغییر تابع قوانین خدمت انتخابی و تأمین‌کننده است. اگر برای یک خدمت سیاست اختصاصی ثبت نشده باشد، کاربر باید پیش از پرداخت شرایط را از پشتیبانی دریافت و تأیید کند.</p></section>
          <section><h2 className="text-xl font-black text-brand">پرداخت اقساطی</h2><p className="mt-2">حداقل پیش‌پرداخت ۵۰ درصد مبلغ کل است. مبلغ تأمین مالی، نرخ کارمزد، تعداد اقساط و تاریخ هر سررسید پیش از ثبت قرارداد نمایش داده می‌شود و تأیید نهایی منوط به اعتبارسنجی است.</p></section>
          <section><h2 className="text-xl font-black text-brand">اختلال فنی و بازپرداخت</h2><p className="mt-2">کسر وجه بدون ثبت سفارش باید از طریق شماره پیگیری بانکی به پشتیبانی اعلام شود. نتیجه بررسی و زمان بازگشت وجه به وضعیت تراکنش و شبکه بانکی وابسته است.</p></section>
        </div>
        <div className="mt-9 flex flex-wrap gap-3"><Link className="rounded-xl bg-brand px-5 py-3 font-black text-white" href="/contact/">پشتیبانی و پیگیری</Link><Link className="rounded-xl border border-border px-5 py-3 font-black text-brand" href="/privacy/">سیاست حفظ حریم خصوصی</Link></div>
      </article>
    </Container>
  );
}