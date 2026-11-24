type AmenityName =
  | "bed"
  | "meal"
  | "pool"
  | "spa"
  | "beach"
  | "wifi"
  | "parking"
  | "fitness"
  | "meeting"
  | "general";

type Props = {
  region: string | null;
  roomType: string;
  serviceType: string;
  description: string | null;
  variant?: "compact" | "tour-card" | "detail";
};

const labels: Record<AmenityName, string> = {
  bed: "اتاق منتخب",
  meal: "رستوران و بار",
  pool: "استخر",
  spa: "اسپا و سونا",
  beach: "ساحل اختصاصی",
  wifi: "وای‌فای",
  parking: "پارکینگ",
  fitness: "باشگاه ورزشی",
  meeting: "سالن جلسات",
  general: "امکانات",
};

const amenityPatterns: Array<{ name: AmenityName; pattern: RegExp }> = [
  { name: "beach", pattern: /beach|ساحل/i },
  { name: "pool", pattern: /pool|استخر/i },
  { name: "spa", pattern: /spa|sauna|اسپا|سونا/i },
  { name: "wifi", pattern: /wifi|wi-fi|وای\s*فای/i },
  { name: "meal", pattern: /restaurant|رستوران|بار|پذیرایی/i },
  { name: "parking", pattern: /parking|پارکینگ/i },
  { name: "fitness", pattern: /fitness|gym|باشگاه|فیتنس/i },
  { name: "meeting", pattern: /meeting|conference|جلسه|کنفرانس/i },
];

export function HotelAmenities({
  region,
  roomType,
  serviceType,
  description,
  variant = "compact",
}: Props) {
  const amenityText = description ?? "";
  const detected = amenityPatterns
    .filter(({ pattern }) => pattern.test(amenityText))
    .map(({ name }) => ({ name, label: labels[name] }));
  const fallback: Array<{ name: AmenityName; label: string }> = [
    { name: "bed", label: roomType || labels.bed },
    { name: "meal", label: serviceType || labels.meal },
    { name: "beach", label: region || labels.beach },
  ];
  const detailItems = [...new Set(amenityText
    .replace(/<(?:br|\/li|\/p|\/div)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean))].map((label) => ({
      name: amenityPatterns.find(({ pattern }) => pattern.test(label))?.name ?? "general" as const,
      label,
    }));
  const items = [
    ...detected,
    ...fallback.filter(
      (item) => !detected.some((detectedItem) => detectedItem.name === item.name),
    ),
  ].slice(0, 5);

  if (variant === "detail") {
    if (!detailItems.length) return null;
    return (
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-brand sm:text-2xl">امکانات هتل</h2>
            <p className="mt-2 text-sm text-muted">خدمات و امکانات ثبت‌شده برای این هتل</p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eef5ff] text-brand">
            <svg aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z" /><path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15Z" /></svg>
          </span>
        </header>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="امکانات هتل">
          {detailItems.map((item) => (
            <li className="flex min-h-12 min-w-0 items-center gap-2 rounded-2xl border border-[#dfe9f6] bg-[#f8fbff] px-4 py-3 text-sm font-black text-brand" key={`${item.name}-${item.label}`}>
              <AmenityIcon name={item.name} variant="detail" />
              <span className="min-w-0">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <ul className={variant === "tour-card" ? "mt-3 flex flex-wrap gap-2" : "mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"} aria-label="امکانات و ویژگی‌های هتل">
      {items.map((item) => (
        <li className={variant === "tour-card" ? "flex min-h-11 min-w-0 flex-1 basis-[9rem] items-center justify-center gap-2 rounded-xl border border-[#dfe9f6] bg-white px-3 py-2 text-xs font-bold text-brand shadow-[0_4px_12px_rgba(5,49,116,.04)] sm:flex-none" : "flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-[#dfe9f6] bg-white px-2 py-3 text-center text-xs font-bold text-brand shadow-[0_6px_16px_rgba(5,49,116,.05)]"} key={`${item.name}-${item.label}`}>
          <AmenityIcon name={item.name} variant={variant} />
          <span className={variant === "tour-card" ? "line-clamp-1" : "line-clamp-2"}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function AmenityIcon({ name, variant = "compact" }: { name: AmenityName; variant?: "compact" | "tour-card" | "detail" }) {
  const paths: Record<AmenityName, React.ReactNode> = {
    general: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    bed: <><path d="M3 16v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5" /><path d="M3 16h18v4M6 8V5h4v3" /></>,
    meal: <><path d="M6 3v7M3 3v4a3 3 0 0 0 6 0V3M6 10v11M16 3v18M16 3c3 1 3 6 0 7" /></>,
    pool: <><path d="M3 18c2 2 4 2 6 0s4-2 6 0 4 2 6 0M3 13c2 2 4 2 6 0s4-2 6 0 4 2 6 0" /><path d="M7 12V6a3 3 0 0 1 6 0M7 8h6" /></>,
    spa: <><path d="M12 20c-4-2-7-5-7-9 3 0 5 1 7 4 2-3 4-4 7-4 0 4-3 7-7 9Z" /><path d="M12 15c-2-3-2-7 0-11 2 4 2 8 0 11Z" /></>,
    beach: <><path d="M3 19h18M5 16c4-4 10-4 14 0M12 16V6" /><path d="M12 6c-3-2-6-1-7 1 3 0 5 1 7 3 2-2 4-3 7-3-1-2-4-3-7-1Z" /></>,
    wifi: <><path d="M3 9a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 15a4 4 0 0 1 6 0" /><path d="M12 19h.01" /></>,
    parking: <><rect height="15" rx="2" width="13" x="5.5" y="4.5" /><path d="M10 16V8h3a2 2 0 0 1 0 4h-3" /></>,
    fitness: <><path d="M4 10v4M7 8v8M17 8v8M20 10v4M7 12h10" /></>,
    meeting: <><rect height="9" rx="2" width="14" x="5" y="4" /><path d="M3 20v-3a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3M9 8h.01M15 8h.01" /></>,
  };
  return <span className={`grid shrink-0 place-items-center rounded-xl ${variant === "tour-card" ? "size-8 bg-[#f4f8ff]" : "size-10"} ${variant === "detail" ? "bg-white shadow-sm" : variant === "compact" ? "bg-[#f4f8ff]" : ""}`}><svg aria-hidden="true" className={`${variant === "tour-card" ? "size-5" : "size-6"} shrink-0 text-[#174d91]`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg></span>;
}
