import { formatPersianDate } from "@/lib/persian-date";

type Stay = { id: number; label: string; departureDate: string | null; nights: number | null };

export function DepartureFilters({ items, date, id, disabled, onDate, onStay }: {
  items: Stay[];
  date: string;
  id: string;
  disabled?: boolean;
  onDate: (date: string) => void;
  onStay: (id: string) => void;
}) {
  const dates = [...new Set(items.map(item => item.departureDate || "undated"))].sort();
  const stays = items.filter(item => (item.departureDate || "undated") === date)
    .sort((a, b) => (a.nights ?? 0) - (b.nights ?? 0) || a.id - b.id);
  const field = "min-h-12 w-full rounded-xl border border-border px-3 disabled:opacity-50";
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="grid gap-2 text-sm font-bold">تاریخ برگزاری
      <select className={field} required disabled={disabled || !dates.length} value={date} onChange={event => onDate(event.target.value)}>
        <option value="">انتخاب تاریخ برگزاری</option>
        {dates.map(day => <option key={day} value={day}>{day === "undated" ? "بدون تاریخ دقیق" : formatPersianDate(day)}</option>)}
      </select>
    </label>
    <label className="grid gap-2 text-sm font-bold">مدت اقامت
      <select className={field} required disabled={disabled || !stays.length} value={id} onChange={event => onStay(event.target.value)}>
        <option value="">انتخاب مدت اقامت</option>
        {stays.map(item => <option key={item.id} value={item.id}>
          {item.nights ? item.nights.toLocaleString("fa-IR") + " شب" : "مدت ثبت نشده"}
          {stays.filter(other => other.nights === item.nights).length > 1 || !item.nights ? " · " + item.label + " (" + item.id + ")" : ""}
        </option>)}
      </select>
    </label>
  </div>;
}
