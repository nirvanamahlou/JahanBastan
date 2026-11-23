const sealCode = "nFPtsnTe7kKQyZ6TebfO4we3M6TSZ6Hd";
const sealQuery = `id=8241734&Code=${sealCode}`;

export function EnamadSeal({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={`https://trustseal.enamad.ir/?${sealQuery}`}
      target="_blank"
      rel="noopener"
      referrerPolicy="origin"
      aria-label="استعلام نماد اعتماد الکترونیکی جهان باستان (باز شدن در تب جدید)"
      className={compact ? "flex h-24 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent" : "mt-4 inline-flex min-h-28 min-w-28 items-center justify-center rounded-xl bg-white p-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"}
    >
      {/* The issuing service must receive the origin and serve its own live seal. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://trustseal.enamad.ir/logo.aspx?${sealQuery}`}
        referrerPolicy="origin"
        alt="نماد اعتماد الکترونیکی جهان باستان"
        className={compact ? "max-h-16 max-w-full object-contain" : "h-auto max-h-32 w-auto max-w-32 cursor-pointer"}
        {...{ code: sealCode }}
      />
    </a>
  );
}
