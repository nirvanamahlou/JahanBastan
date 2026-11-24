"use client";

import { useState } from "react";

const sealCode = "nFPtsnTe7kKQyZ6TebfO4we3M6TSZ6Hd";
const sealQuery = `id=8241734&Code=${sealCode}`;

export function EnamadSeal({ compact = false }: { compact?: boolean }) {
  const [useBackup, setUseBackup] = useState(false);

  return (
    <a
      href={`https://trustseal.enamad.ir/?${sealQuery}`}
      target="_blank"
      rel="noopener"
      referrerPolicy="origin"
      aria-label="استعلام نماد اعتماد الکترونیکی جهان باستان (باز شدن در تب جدید)"
      className={compact ? "flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent" : "mt-4 inline-flex min-h-28 min-w-28 items-center justify-center rounded-xl bg-white p-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(image) => { if (image?.complete && !image.naturalWidth) setUseBackup(true); }}
        onError={() => setUseBackup(true)}
        src={useBackup ? "/images/enamad-jahanbastan.png" : `https://trustseal.enamad.ir/logo.aspx?${sealQuery}`}
        referrerPolicy="origin"
        alt="نماد اعتماد الکترونیکی جهان باستان"
        className={compact ? "max-h-8 max-w-full object-contain text-center text-[.55rem] leading-tight" : "h-auto max-h-32 w-auto max-w-32 cursor-pointer"}
        {...{ code: sealCode }}
      />
    </a>
  );
}
