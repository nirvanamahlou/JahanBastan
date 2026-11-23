"use client";

import { type ReactNode, useState } from "react";

import { Button } from "./button";
import { Dialog } from "./dialog";

export function FilterChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 text-xs font-bold text-brand">
      {label}
      {onRemove ? <button type="button" onClick={onRemove} aria-label={`حذف فیلتر ${label}`} className="text-base">×</button> : null}
    </span>
  );
}

export function FilterDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>فیلترها</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="فیلتر نتایج" description="گزینه‌های موردنظر را انتخاب کنید.">
        {children}
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>اعمال فیلترها</Button>
      </Dialog>
    </>
  );
}
