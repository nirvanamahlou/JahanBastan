"use client";

import Image from "next/image";
import Link from "next/link";

import { useComparison } from "./comparison-provider";

function displayedPrice(item: { kind: "hotel" | "tour"; price: string }) {
  return item.kind === "hotel" ? "تماس بگیرید" : item.price;
}

export function ComparisonPage() {
  const { items, clear, remove } = useComparison();
  const kind = items[0]?.kind;
  const labels = [
    ...new Set(items.flatMap((item) => item.fields.map((field) => field.label))),
  ];

  if (!items.length) {
    return (
      <section
        className="mx-auto max-w-3xl rounded-3xl border border-dashed border-border bg-white p-6 text-center shadow-[0_18px_50px_rgba(1,37,105,.08)] sm:p-10"
        dir="rtl"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff1f7] text-2xl text-[#c72169]">
          ⇄
        </span>
        <p className="mt-4 text-sm font-bold text-accent-strong">
          هنوز گزینه‌ای انتخاب نشده است
        </p>
        <h1 className="mt-2 text-2xl font-black text-brand">
          مقایسهٔ هوشمند سفر
        </h1>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">
          در کارت هتل یا تور، دکمهٔ «مقایسه» را بزنید. حداکثر سه گزینه
          کنار هم قرار می‌گیرند.
        </p>
        <Link
          className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-[#ef6fa9] px-6 font-black text-white shadow-[0_12px_28px_rgba(223,79,145,.28)]"
          href="/hotels/"
        >
          مشاهدهٔ هتل‌ها
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl" dir="rtl">
      <header className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#012569,#0c4c9c)] p-5 text-white shadow-[0_20px_48px_rgba(1,37,105,.18)] sm:rounded-3xl sm:p-8">
        <p className="text-xs leading-6 text-white/70 sm:text-sm">
          انتخاب مطمئن‌تر، با دیدن تفاوت‌ها در یک نگاه
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black sm:text-3xl">
            مقایسهٔ {kind === "hotel" ? "هتل‌ها" : "تور‌ها"}
          </h1>
          <button
            className="min-h-11 shrink-0 rounded-xl border border-white/25 px-3 text-xs font-bold text-white sm:px-4 sm:text-sm"
            onClick={clear}
            type="button"
          >
            پاک کردن همه
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-white/75 md:hidden">
          <span className="rounded-full bg-white/12 px-3 py-1.5">
            {items.length.toLocaleString("fa-IR")} گزینه
          </span>
          <span>جزئیات هر گزینه را پایین ببینید</span>
        </div>
      </header>

      <div className="mt-5 grid gap-4 md:hidden">
        {items.map((item, index) => (
          <article
            className="overflow-hidden rounded-[1.75rem] border border-brand/10 bg-white shadow-[0_16px_40px_rgba(1,37,105,.09)]"
            key={item.id}
          >
            <div className="flex items-center gap-3 bg-surface-muted p-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-accent">
                {item.imageUrl ? (
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    sizes="80px"
                    src={item.imageUrl}
                  />
                ) : (
                  <span className="grid h-full place-items-center text-2xl">✦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-black text-accent-strong">
                  گزینهٔ {(index + 1).toLocaleString("fa-IR")}
                </span>
                <Link
                  className="mt-1 line-clamp-2 block text-base font-black leading-7 text-brand"
                  href={item.href}
                >
                  {item.title}
                </Link>
                <p className="mt-1 font-black text-[#c72169]">{displayedPrice(item)}</p>
              </div>
            </div>
            <dl className="divide-y divide-border/75 px-4">
              {labels.map((label) => (
                <div
                  className="grid grid-cols-[minmax(6rem,.8fr)_minmax(0,1.2fr)] gap-3 py-3.5"
                  key={label}
                >
                  <dt className="text-xs font-black text-brand">{label}</dt>
                  <dd className="text-xs leading-6 text-muted">
                    {item.fields.find((field) => field.label === label)?.value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-border p-4">
              <Link
                className="flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white"
                href={item.href}
              >
                مشاهدهٔ جزئیات
              </Link>
              <button
                className="flex min-h-11 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-bold text-danger"
                onClick={() => remove(item.id)}
                type="button"
              >
                حذف
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-3xl border border-border bg-white shadow-[0_14px_36px_rgba(1,37,105,.08)] md:block">
        <table className="w-full min-w-[46rem] border-collapse text-right">
          <thead>
            <tr className="bg-surface-muted">
              <th className="w-40 p-4 text-sm font-black text-brand">ویژگی</th>
              {items.map((item) => (
                <th
                  className="min-w-56 border-s border-border p-4 align-top"
                  key={item.id}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                      {item.imageUrl ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="56px"
                          src={item.imageUrl}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        className="line-clamp-2 text-sm font-black text-brand hover:text-accent-strong"
                        href={item.href}
                      >
                        {item.title}
                      </Link>
                      <button
                        className="mx-auto mt-3 flex min-h-8 w-fit items-center justify-center rounded-lg px-3 text-xs font-bold text-danger"
                        onClick={() => remove(item.id)}
                        type="button"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <th className="p-4 text-sm font-black text-brand">قیمت</th>
              {items.map((item) => (
                <td
                  className="border-s border-border p-4 text-sm font-black text-[#c72169]"
                  key={item.id}
                >
                  {displayedPrice(item)}
                </td>
              ))}
            </tr>
            {labels.map((label) => (
              <tr className="border-t border-border" key={label}>
                <th className="bg-surface-muted/55 p-4 text-sm font-bold text-brand">
                  {label}
                </th>
                {items.map((item) => (
                  <td
                    className="border-s border-border p-4 text-sm leading-7 text-muted"
                    key={item.id}
                  >
                    {item.fields.find((field) => field.label === label)?.value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
