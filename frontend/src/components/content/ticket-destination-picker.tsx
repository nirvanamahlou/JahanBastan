import Image from "next/image";
import Link from "next/link";

import {
  BookIcon,
  BusIcon,
  LocationIcon,
  PlaneIcon,
  TrainIcon,
} from "@/components/layout/site-icons";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { SearchableTicketDestinations } from "@/components/content/searchable-ticket-destinations";

export type TicketDestinationChoice = {
  label: string;
  imageId: number | null;
  ticketCount: number;
};

type TicketKind = "flight" | "bus" | "train" | "visa";

const kindLabels: Record<TicketKind, string> = {
  flight: "پرواز",
  bus: "اتوبوس",
  train: "قطار",
  visa: "ویزا",
};

export function TicketDestinationPicker({
  choices,
  kind,
  hrefForDestination,
  guide,
}: {
  choices: TicketDestinationChoice[];
  kind: TicketKind;
  hrefForDestination: (destination: string) => string;
  guide?: string;
}) {
  const Icon = kind === "flight" ? PlaneIcon : kind === "train" ? TrainIcon : kind === "visa" ? BookIcon : BusIcon;
  const label = kindLabels[kind];

  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/70 p-5 shadow-[0_22px_58px_rgba(1,37,105,0.12)] ring-1 ring-brand/5 backdrop-blur-xl sm:p-7">
      <div className="grid gap-5 border-b border-brand/10 pb-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-accent/70 bg-accent/35 text-brand shadow-sm">
          <Icon className="size-7" />
        </span>
        <div>
          <p className="text-sm font-black text-accent-strong">انتخاب مقصد</p>
          <h2 className="mt-1 text-2xl font-black text-brand">برای مشاهده بلیط، ابتدا شهر مقصد را انتخاب کنید</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            پس از انتخاب مقصد، فقط گزینه‌های {label} همان مسیر نمایش داده می‌شوند و می‌توانید مبدأ، تاریخ و سایر فیلترها را دقیق‌تر تعیین کنید.
          </p>
        </div>
      </div>

      {guide?.trim() ? (
        <p className="mt-5 rounded-2xl border border-brand/10 bg-brand-soft/45 px-4 py-3 text-sm leading-7 text-foreground/85">
          {guide}
        </p>
      ) : null}

      {choices.length ? (
        <SearchableTicketDestinations labels={choices.map((choice) => choice.label)}>
          {choices.map((choice) => (
            <Link
              className="group overflow-hidden rounded-[1.5rem] border border-white/90 bg-white/80 ring-1 ring-brand/5 transition duration-300 ease-out hover:-translate-y-1 hover:border-accent-strong/45 hover:shadow-[0_20px_42px_rgba(1,37,105,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
              href={hrefForDestination(choice.label)}
              key={choice.label}
            >
              <div className="relative flex aspect-[16/9] items-end overflow-hidden bg-[linear-gradient(135deg,#012569,#315ca8)] p-4 text-white">
                {choice.imageId ? (
                  <Image
                    alt=""
                    className="object-cover transition duration-700 group-hover:scale-110"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    src={PUBLIC_API_BASE_URL + "/media/" + choice.imageId}
                  />
                ) : null}
                <span className="absolute inset-0 bg-gradient-to-t from-brand/85 via-brand/20 to-transparent" />
                <span className="relative z-10 grid size-10 place-items-center rounded-xl border border-white/35 bg-white/15 backdrop-blur-sm">
                  <Icon className="size-5" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="inline-flex items-center gap-1 text-xs font-bold text-muted"><LocationIcon className="size-3.5 text-accent-strong" /> مقصد سفر</p>
                  <h3 className="mt-1 text-lg font-black text-brand">{choice.label}</h3>
                </div>
                <span className="rounded-xl bg-accent/45 px-2.5 py-1.5 text-xs font-black text-brand">
                  {choice.ticketCount.toLocaleString("fa-IR")} بلیط
                </span>
              </div>
            </Link>
          ))}
        </SearchableTicketDestinations>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted/70 px-5 py-10 text-center">
          <p className="font-black text-brand">هنوز مقصدی برای این بلیط‌ها ثبت نشده است</p>
          <p className="mt-2 text-sm leading-7 text-muted">پس از وارد کردن مقصد برای بلیط‌ها در پنل مدیریت، کارت شهرها در این بخش نمایش داده می‌شود.</p>
        </div>
      )}
    </section>
  );
}
