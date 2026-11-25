import Link from "next/link";
import { formatPersianDate } from "@/lib/persian-date";

type Props = {
  pathname: string;
  selectedDate?: string;
  searchParams: Record<string, string | undefined>;
  prices?: ReadonlyMap<string, string[]>;
  availableDates?: ReadonlySet<string>;
};

const gregorianDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function TransportDateStrip({ pathname, selectedDate, searchParams, availableDates, prices }: Props) {
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate ?? "")
    ? new Date(`${selectedDate}T12:00:00Z`)
    : null;
  const bookableDays = [...(availableDates ?? [])].sort();
  const firstAvailable = bookableDays[0];
  const center = selected && Number.isFinite(selected.getTime())
    ? selected
    : firstAvailable ? new Date(`${firstAvailable}T12:00:00Z`) : new Date();
  const centerDay = center.toISOString().slice(0, 10);
  const previousAvailable = bookableDays.findLast((day) => day < centerDay);
  const nextAvailable = bookableDays.find((day) => day > centerDay);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(center);
    date.setUTCDate(center.getUTCDate() + index - 3);
    return date;
  });
  const baseQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "departureFrom") baseQuery.set(key, value);
  }
  function hrefFor(day?: string) {
    const query = new URLSearchParams(baseQuery);
    if (day) query.set("departureFrom", day);
    return query.size ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav aria-label="انتخاب روز حرکت" className="mb-5 rounded-2xl border border-border bg-surface p-2 shadow-sm">
      {availableDates ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 text-xs font-bold text-brand">
          <Link className="rounded-lg px-2 py-1.5 hover:bg-brand-soft" href={hrefFor()} aria-current={!selectedDate ? "true" : undefined} scroll={false}>
            همهٔ تاریخ‌ها
          </Link>
          <div className="flex flex-wrap gap-1">
            {previousAvailable ? (
              <Link className="rounded-lg px-2 py-1.5 hover:bg-brand-soft" href={hrefFor(previousAvailable)} scroll={false}>پرواز قبلی</Link>
            ) : null}
            {nextAvailable ? (
              <Link className="rounded-lg px-2 py-1.5 hover:bg-brand-soft" href={hrefFor(nextAvailable)} scroll={false}>پرواز بعدی</Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <div className={`grid grid-cols-7 gap-1 ${prices ? "min-w-[40rem]" : "min-w-[32rem]"}`}>
        {days.map((date) => {
          const value = date.toISOString().slice(0, 10);
          const active = value === selectedDate;
          const available = availableDates?.has(value) ?? false;
          const color = available
            ? "bg-[#fce5ef] text-[#651b43] hover:bg-[#f8d2e5]"
            : active ? "bg-brand text-white shadow-sm" : "text-brand hover:bg-brand-soft";
          return (
            <Link
              aria-current={active ? "date" : undefined}
              className={`rounded-xl px-2 py-2.5 text-center transition ${color} ${available && active ? "ring-2 ring-inset ring-[#b52c73]" : ""}`}
              href={hrefFor(value)}
              key={value}
              data-flight-available={available || undefined}
              scroll={false}
            >
              <span className="block text-xs font-black">{formatPersianDate(value).split(" ").slice(0, 2).join(" ")}</span>
              <time className={`mt-1 block text-[10px] ${available ? "text-[#742750]" : active ? "text-white/80" : "text-muted"}`} dateTime={value} dir="ltr">
                {gregorianDate.format(date)}
              </time>
              {prices?.get(value)?.map(price => <span key={price} className="mt-1 block text-[11px] font-bold leading-5">از {price}</span>)}
              {available ? <span className="sr-only">پرواز موجود است</span> : null}
            </Link>
          );
        })}
      </div>
      </div>
    </nav>
  );
}
