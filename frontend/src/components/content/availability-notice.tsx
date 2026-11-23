"use client";

import Image from "next/image";
import { useState } from "react";

import { AccountForm } from "@/components/account-form";
import { PlaneIcon } from "@/components/layout/site-icons";
import { Button } from "@/components/ui/button";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type Props = {
  departureDate?: string;
  destination?: string;
  iconImageId?: number | null;
  label: string;
  origin?: string;
  serviceType: "flight" | "train" | "bus";
};

export function AvailabilityNotice({ departureDate, destination, iconImageId, label, origin, serviceType }: Props) {
  const [open, setOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function subscribe() {
    if (!origin || !destination || !departureDate) {
      setError("برای ثبت اطلاع‌رسانی، مبدأ، مقصد و تاریخ حرکت را انتخاب کنید.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/availability-alerts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceType, origin, destination, departureDate }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setRegistered(true);
      setOpen(false);
    } else if (response?.status === 401) {
      setOpen(true);
    } else {
      setError("ثبت درخواست ناموفق بود؛ دوباره تلاش کنید.");
    }
  }

  return <>
    <section className="rounded-3xl border border-dashed border-brand/25 bg-white px-5 py-10 text-center shadow-sm">
      <div className="relative mx-auto grid size-20 place-items-center overflow-hidden rounded-full bg-brand-soft text-brand">
        {iconImageId ? <Image alt="" fill className="object-contain p-2" src={`${PUBLIC_API_BASE_URL}/media/${iconImageId}`} /> : <PlaneIcon className="size-9" />}
      </div>
      <h3 className="mt-5 text-xl font-black text-brand">در این تاریخ بلیتی موجود نیست</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted">تاریخ یا فیلترها را تغییر دهید؛ همچنین می‌توانید درخواست اطلاع‌رسانی برای {label} را ثبت کنید.</p>
      {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
      {registered ? <p className="mt-5 font-black text-brand">درخواست اطلاع‌رسانی شما ثبت شد.</p> : <Button className="mt-5" loading={busy} onClick={() => void subscribe()} type="button">موجود شد خبرم کن</Button>}
    </section>
    {open ? <div aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-brand/60 p-4 backdrop-blur-sm" role="dialog"><div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><button aria-label="بستن" className="absolute left-4 top-4 grid size-10 place-items-center rounded-full border border-border text-xl text-brand" onClick={() => setOpen(false)} type="button">×</button><h2 className="text-center text-xl font-black text-brand">ورود یا ثبت‌نام</h2><p className="mb-6 mt-2 text-center text-sm text-muted">برای ثبت اطلاع‌رسانی ابتدا وارد حساب خود شوید.</p><AccountForm onAuthenticated={() => void subscribe()} /></div></div> : null}
  </>;
}