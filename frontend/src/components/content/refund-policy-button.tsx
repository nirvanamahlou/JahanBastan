"use client";

import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";

export function RefundPolicyButton({ policy }: { policy: string | null }) {
  const [open, setOpen] = useState(false);
  const content = policy?.trim() || "قوانین استرداد این خدمت هنوز ثبت نشده است. برای اطلاع از شرایط کنسلی و تغییر تاریخ با کارشناسان ما تماس بگیرید.";
  return <>
    <button className="mt-4 rounded-lg px-2.5 py-1 text-xs font-black text-brand underline underline-offset-4 transition-colors hover:bg-accent-strong hover:text-white focus-visible:bg-accent-strong focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2" onClick={() => setOpen(true)} type="button">قوانین استرداد</button>
    <Dialog open={open} title="قوانین استرداد و تغییر" onClose={() => setOpen(false)}>
      <div className="whitespace-pre-wrap text-sm leading-8 text-foreground">{content}</div>
    </Dialog>
  </>;
}
