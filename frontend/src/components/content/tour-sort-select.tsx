"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SiteSelect, type SiteSelectOption } from "@/components/ui/site-select";

type TourSortOption = SiteSelectOption & { href: string };

export function TourSortSelect({ value, options }: { value: string; options: readonly TourSortOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useOptimistic(value);
  const [pending, startTransition] = useTransition();

  function changeSort(next: string) {
    const option = options.find((item) => item.value === next);
    if (!option || next === selected) return;
    startTransition(() => {
      setSelected(next);
      router.replace(option.href, { scroll: false });
    });
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2" aria-busy={pending}>
      <label className="text-xs text-muted" htmlFor="tour-sort">مرتب‌سازی</label>
      <SiteSelect ariaLabel="مرتب‌سازی تورها" id="tour-sort" value={selected} onValueChange={changeSort} options={options} />
    </div>
  );
}
