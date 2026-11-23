"use client";

import Image from "next/image";

import { CartAddButton } from "@/components/customer-commerce-actions";
import { RefundPolicyButton } from "@/components/content/refund-policy-button";
import {
  type TicketDirection,
  useTicketSelection,
} from "@/components/content/ticket-selection-provider";
import {
  BusIcon,
  ClockIcon,
  LocationIcon,
  SuitcaseIcon,
  TrainIcon,
} from "@/components/layout/site-icons";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatBaggageAllowance } from "@/lib/baggage";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import { formatTravelDuration } from "@/lib/travel-duration";

type TransportKind = "bus" | "train";

type TransportResultCardProps = {
  id: number;
  kind: TransportKind;
  slug: string;
  title: string;
  summary: string;
  direction: TicketDirection;
  useReturnLeg?: boolean;
  origin: string | null;
  destinationName: string | null;
  originTerminal: string | null;
  destinationTerminal: string | null;
  departureDate: string | null;
  returnDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  returnTime: string | null;
  returnArrivalTime: string | null;
  providerCompany: string | null;
  providerIconImageId: number | null;
  transportClass: string | null;
  compartmentType: "regular" | "private" | null;
  passengerCategory: "all" | "women" | "men" | null;
  carTransport: boolean;
  baggageAllowance: string | null;
  availableSeats: number | null;
  basePrice: string | null;
  currency: string;
  refundPolicy: string | null;
  isFeatured: boolean;
};

const shownTime = (value: string | null) => value?.slice(0, 5) || "اعلام می‌شود";

const passengerLabels = {
  all: "مسافران عادی",
  women: "ویژه خواهران",
  men: "ویژه برادران",
};

export function TransportResultCard(props: TransportResultCardProps) {
  const Icon = props.kind === "bus" ? BusIcon : TrainIcon;
  const label = props.kind === "bus" ? "اتوبوس" : "قطار";
  const selection = useTicketSelection();
  const usesReturnLeg = props.direction === "return" && props.useReturnLeg;
  const origin = usesReturnLeg ? props.destinationName : props.origin;
  const destination = usesReturnLeg ? props.origin : props.destinationName;
  const originTerminal = usesReturnLeg
    ? props.destinationTerminal
    : props.originTerminal;
  const destinationTerminal = usesReturnLeg
    ? props.originTerminal
    : props.destinationTerminal;
  const departureDate = usesReturnLeg ? props.returnDate : props.departureDate;
  const departureTime = usesReturnLeg ? props.returnTime : props.departureTime;
  const arrivalTime = usesReturnLeg ? props.returnArrivalTime : props.arrivalTime;
  const travelDuration = formatTravelDuration(departureTime, arrivalTime);
  const ticketKey = `transport-${props.kind}-${props.id}-${props.direction}-${usesReturnLeg ? "embedded" : "direct"}`;
  const selected = selection.isSelected(ticketKey);
  const visible = !selection.roundTrip || selection.activeLeg === props.direction;
  const directionLabel = props.direction === "outbound" ? "بلیت رفت" : "بلیت برگشت";
  const seatsLabel = props.availableSeats === null
    ? "ظرفیت در حال استعلام"
    : props.availableSeats > 0
      ? `${props.availableSeats.toLocaleString("fa-IR")} صندلی باقی‌مانده`
      : "تکمیل ظرفیت";

  if (!visible) return null;

  return (
    <article className={`flight-interactive-panel content-card-motion relative overflow-hidden rounded-2xl border bg-white shadow-[0_10px_28px_rgba(1,37,105,0.07)] ${selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-border/80"}`}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs font-black text-brand">
              <Icon className="size-4" /> {directionLabel}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {travelDuration ? <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-black text-brand">{travelDuration}</span> : null}
              {props.isFeatured ? <span className="rounded-full bg-accent-strong px-3 py-1 text-xs font-black text-white">پرفروش</span> : null}
              <span className={`rounded-full px-3 py-1 text-xs font-black ${props.availableSeats === 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {seatsLabel}
              </span>
            </div>
          </div>
          <div className="flight-route-line mt-2 grid grid-cols-[minmax(0,1fr)_minmax(3.75rem,0.8fr)_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-brand/15 bg-surface-muted/70 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(5rem,1.6fr)_minmax(0,1fr)] sm:px-4" dir="rtl">
            <div className="min-w-0 text-right">
              <strong className="block text-base text-brand sm:text-lg">{shownTime(departureTime)}</strong>
              <p className="mt-0.5 truncate text-sm font-black text-foreground">{origin || "\u0645\u0628\u062f\u0623"}</p>
              <p className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted">
                <LocationIcon className="size-3.5 shrink-0" />
                {originTerminal || (props.kind === "bus" ? "\u062a\u0631\u0645\u06cc\u0646\u0627\u0644 \u0645\u0628\u062f\u0623" : "\u0627\u06cc\u0633\u062a\u06af\u0627\u0647 \u0645\u0628\u062f\u0623")}
              </p>
            </div>
            <div aria-label={`\u0645\u0633\u06cc\u0631 ${origin || "\u0645\u0628\u062f\u0623"} \u0628\u0647 ${destination || "\u0645\u0642\u0635\u062f"}`} className="flex min-w-0 items-center gap-1.5 text-brand">
              <span className="size-2 shrink-0 rounded-full border-2 border-brand bg-surface" />
              <span className="h-px min-w-0 flex-1 bg-brand/35" />
              <Icon className="size-5 shrink-0 text-accent-strong" />
              <span className="h-px min-w-0 flex-1 bg-brand/35" />
              <span className="size-2 shrink-0 rounded-full border-2 border-brand bg-surface" />
            </div>
            <div className="min-w-0 text-left">
              <strong className="block text-base text-brand sm:text-lg">{shownTime(arrivalTime)}</strong>
              <p className="mt-0.5 truncate text-sm font-black text-foreground">{destination || "\u0645\u0642\u0635\u062f"}</p>
              <p className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted">
                <LocationIcon className="size-3.5 shrink-0" />
                {destinationTerminal || (props.kind === "bus" ? "\u062a\u0631\u0645\u06cc\u0646\u0627\u0644 \u0645\u0642\u0635\u062f" : "\u0627\u06cc\u0633\u062a\u06af\u0627\u0647 \u0645\u0642\u0635\u062f")}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs xl:grid-cols-4">
            <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-foreground">{props.providerCompany || props.title}</span>
            <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-foreground">{props.transportClass || label}</span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2.5 py-1.5">
              <ClockIcon className="size-3.5 text-brand" />
              {departureDate ? formatPersianDate(departureDate) : "تاریخ اعلام می‌شود"}
            </span>
            <span className="rounded-lg bg-accent/45 px-2.5 py-1.5 font-bold text-brand">{directionLabel}</span>
            {props.kind === "train" && props.compartmentType ? (
              <span className="rounded-lg bg-surface-muted px-2.5 py-1.5">
                {props.compartmentType === "private" ? "کوپه دربست" : "کوپه عادی"}
              </span>
            ) : null}
            {props.kind === "train" && props.passengerCategory ? (
              <span className="rounded-lg bg-surface-muted px-2.5 py-1.5">
                {passengerLabels[props.passengerCategory]}
              </span>
            ) : null}
            {props.kind === "train" && props.carTransport ? (
              <span className="rounded-lg bg-surface-muted px-2.5 py-1.5">حمل خودرو</span>
            ) : null}
            {props.baggageAllowance ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2.5 py-1.5">
                <SuitcaseIcon className="size-3.5 text-brand" />
                {formatBaggageAllowance(props.baggageAllowance)}
              </span>
            ) : null}
          </div>
          {props.summary ? <p className="mt-3 line-clamp-2 text-xs leading-6 text-muted">{props.summary}</p> : null}
          <div className="mt-3 flex flex-col gap-2 border-t border-brand/10 pt-3 sm:flex-row">
            <CartAddButton className="min-w-0 flex-1" buttonClassName="!min-h-10 text-xs sm:text-sm" itemType={props.kind} travelServiceId={props.id} />
          <button
            aria-pressed={selected}
            className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl px-4 text-sm font-black text-white transition focus-visible:ring-4 focus-visible:ring-accent ${selected ? "bg-emerald-600 hover:bg-emerald-700" : "bg-accent-strong hover:bg-brand"}`}
            onClick={() => selection.selectTicket({
              key: ticketKey,
              travelServiceId: props.id,
              direction: props.direction,
              title: props.title,
              provider: props.providerCompany,
              origin: origin || "مبدأ",
              destination: destination || "مقصد",
              departureTime,
              arrivalTime,
              price: props.basePrice,
              currency: props.currency,
            })}
            type="button"
          >
            {selected ? `${directionLabel} انتخاب شد` : `انتخاب ${directionLabel}`}
          </button>
          </div>
        </div>
        <aside className="flex flex-col justify-start gap-3 border-t-2 border-brand/15 bg-surface-muted/85 p-4 lg:border-r-2 lg:border-t-0">
          <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white text-brand">
            {props.providerIconImageId ? (
              <Image
                alt={`\u0644\u0648\u06af\u0648\u06cc ${props.providerCompany ?? label}`}
                className="object-cover"
                fill
                sizes="40px"
                src={`${PUBLIC_API_BASE_URL}/media/${props.providerIconImageId}`}
              />
            ) : <Icon className="size-5" />}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted lg:grid-cols-1">
            <span className="inline-flex items-center gap-2">
              <ClockIcon className="size-4 text-brand" />
              {travelDuration || "\u0645\u062f\u062a \u0633\u0641\u0631 \u0627\u0639\u0644\u0627\u0645 \u0645\u06cc\u200c\u0634\u0648\u062f"}
            </span>
            <span className="inline-flex items-center gap-2">
              <SuitcaseIcon className="size-4 text-brand" />
              {props.baggageAllowance ? formatBaggageAllowance(props.baggageAllowance) : "\u0628\u0627\u0631 \u0645\u062c\u0627\u0632 \u0627\u0639\u0644\u0627\u0645 \u0645\u06cc\u200c\u0634\u0648\u062f"}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted">{"\u0642\u06cc\u0645\u062a \u0647\u0631 \u0645\u0633\u0627\u0641\u0631"}</p>
            <strong className="mt-1 block text-lg text-brand">
              {props.basePrice ? formatCurrency(props.basePrice, props.currency) : "\u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0642\u06cc\u0645\u062a"}
            </strong>
          </div>

          <RefundPolicyButton policy={props.refundPolicy} />
        </aside>
      </div>
    </article>
  );
}