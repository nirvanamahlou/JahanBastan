"use client";

import { useId, type ReactNode, type RefObject } from "react";

export function FlightDetailsDialog({ actionLabel, children, dialogRef, onContinue, price, priceLabel, title }: {
  actionLabel: string;
  children: ReactNode;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onContinue: () => void;
  price: string;
  priceLabel: string;
  title: string;
}) {
  const titleId = useId();
  return (
    <dialog
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[min(84dvh,48rem)] w-[calc(100%-2rem)] max-w-3xl overflow-auto rounded-3xl border border-brand/20 bg-surface text-foreground shadow-2xl backdrop:bg-brand/55"
      dir="rtl"
      ref={dialogRef}
    >
      <header className="flex items-center justify-between gap-3 border-b border-brand/15 bg-brand-soft px-4 py-3 sm:px-6">
        <h2 className="text-lg font-black text-brand" id={titleId}>{title}</h2>
        <button aria-label="بستن جزئیات" className="size-11 shrink-0 rounded-full border border-brand/20 bg-white text-xl text-brand" onClick={() => dialogRef.current?.close()} type="button">×</button>
      </header>
      <div className="grid gap-3 px-4 py-4 sm:px-6">
        <h3 className="text-sm font-black text-brand">اطلاعات سفر</h3>
        {children}
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-brand/15 bg-surface px-4 py-3 sm:px-6">
        <div><span className="block text-xs text-muted">{priceLabel}</span><strong className="text-brand">{price}</strong></div>
        <button className="min-h-11 rounded-xl bg-accent-strong px-4 text-sm font-black text-white" onClick={() => {
          dialogRef.current?.close();
          onContinue();
        }} type="button">{actionLabel}</button>
      </footer>
    </dialog>
  );
}
