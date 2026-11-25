"use client";

import { FlightRouteCard } from "./flight-route-card";

import { CartAddButton } from "@/components/customer-commerce-actions";
import { RefundPolicyButton } from "@/components/content/refund-policy-button";
import {
  type TicketDirection,
  useTicketSelection,
} from "@/components/content/ticket-selection-provider";
import {
  ClockIcon,
  PlaneTakeoffIcon,
  SuitcaseIcon,
} from "@/components/layout/site-icons";
import { formatBaggageAllowance } from "@/lib/baggage";
import { formatCurrency } from "@/lib/currency";
import { formatTravelDuration } from "@/lib/travel-duration";

type FlightResultCardProps = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  serviceCategory: string | null;
  aircraftModel: string | null;
  direction: TicketDirection;
  useReturnLeg?: boolean;
  origin: string | null;
  destination: string | null;
  originAirport: string | null;
  originAirportCode: string | null;
  destinationAirport: string | null;
  destinationAirportCode: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  returnTime: string | null;
  returnArrivalTime: string | null;
  refundPolicy: string | null;
  provider: string | null;
  providerIconImageId: number | null;
  flightNumber: string | null;
  returnFlightNumber: string | null;
  baggage: string | null;
  stopsCount: number | null;
  availableSeats: number | null;
  price: string | null;
  currency: string;
  isFeatured: boolean;
};

const shownTime = (value: string | null) => value?.slice(0, 5) || "اعلام می‌شود";
const categoryLabels: Record<string, string> = { scheduled: "سیستمی", charter: "چارتر", promotional: "ویژه" };
const airportLabel = (name: string, code: string | null) => code ? `${name} (${code})` : name;

export function FlightResultCard(props: FlightResultCardProps) {
  const selection = useTicketSelection();
  const usesReturnLeg = props.direction === "return" && props.useReturnLeg;
  const baseOrigin = props.originAirport || props.origin || "فرودگاه مبدأ";
  const baseDestination = (
    props.destinationAirport || props.destination || "فرودگاه مقصد"
  );
  const origin = airportLabel(
    usesReturnLeg ? baseDestination : baseOrigin,
    usesReturnLeg ? props.destinationAirportCode : props.originAirportCode,
  );
  const destination = airportLabel(
    usesReturnLeg ? baseOrigin : baseDestination,
    usesReturnLeg ? props.originAirportCode : props.destinationAirportCode,
  );
  const departureTime = usesReturnLeg ? props.returnTime : props.departureTime;
  const arrivalTime = usesReturnLeg ? props.returnArrivalTime : props.arrivalTime;
  const travelDuration = formatTravelDuration(departureTime, arrivalTime);
  const flightNumber = usesReturnLeg
    ? props.returnFlightNumber
    : props.flightNumber;
  const ticketKey = `flight-${props.id}-${props.direction}-${usesReturnLeg ? "embedded" : "direct"}`;
  const selected = selection.isSelected(ticketKey);
  const visible = !selection.roundTrip || selection.activeLeg === props.direction;
  const directionLabel = props.direction === "outbound" ? "بلیت رفت" : "بلیت برگشت";

  if (!visible) return null;

  const price = props.price ? formatCurrency(props.price, props.currency) : "استعلام قیمت";
  const selectTicket = () => selection.selectTicket({
    key: ticketKey,
    direction: props.direction,
    title: props.title,
    provider: props.provider,
    origin,
    destination,
    departureTime,
    arrivalTime,
    price: props.price,
    currency: props.currency,
    travelServiceId: props.id,
  });

  return (
    <article
      data-scroll-reveal
      id={`ticket-card-${ticketKey}`}
      className={`flight-interactive-panel content-card-motion relative overflow-hidden rounded-2xl border-2 bg-white/90 shadow-[0_10px_28px_rgba(1,37,105,0.07)] ${selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-brand/20"}`}
    >
      {props.isFeatured ? (
        <span className="absolute left-4 top-4 z-10 rounded-full bg-accent-strong px-3 py-1 text-xs font-black text-white">
          پرفروش
        </span>
      ) : null}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-black text-brand">
            <PlaneTakeoffIcon className="size-4" /> {directionLabel}
          </p>
          <FlightRouteCard
            label={directionLabel} carrier={props.provider || ""}
            flightNumber={flightNumber} duration={travelDuration || undefined}
            cabin={props.serviceCategory ? categoryLabels[props.serviceCategory] ?? props.serviceCategory : null}
            baggage={props.baggage ? formatBaggageAllowance(props.baggage) : null}
            origin={{ city: usesReturnLeg ? props.destination || baseDestination : props.origin || baseOrigin, code: usesReturnLeg ? props.destinationAirportCode : props.originAirportCode, time: shownTime(departureTime) }}
            destination={{ city: usesReturnLeg ? props.origin || baseOrigin : props.destination || baseDestination, code: usesReturnLeg ? props.originAirportCode : props.destinationAirportCode, time: shownTime(arrivalTime) }}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs xl:grid-cols-4">
            <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-foreground">{props.provider || "\u0634\u0631\u06a9\u062a \u0647\u0648\u0627\u067e\u06cc\u0645\u0627\u06cc\u06cc \u0627\u0639\u0644\u0627\u0645 \u0645\u06cc\u200c\u0634\u0648\u062f"}</span>
            {flightNumber ? <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-foreground">{"\u0634\u0645\u0627\u0631\u0647 \u067e\u0631\u0648\u0627\u0632"} <bdi className="font-mono font-bold" dir="ltr">{flightNumber}</bdi></span> : null}
            {travelDuration ? <span className="rounded-lg bg-brand/10 px-2.5 py-1.5 font-bold text-brand">{"\u0645\u062f\u062a \u0633\u0641\u0631"} {travelDuration}</span> : null}
            {props.aircraftModel ? <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-foreground">هواپیما: {props.aircraftModel}</span> : null}
            {props.serviceCategory ? <span className="rounded-lg bg-brand/10 px-2.5 py-1.5 font-bold text-brand">{categoryLabels[props.serviceCategory] ?? props.serviceCategory}</span> : null}
            {props.availableSeats !== null ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700">{props.availableSeats.toLocaleString("fa-IR")} {"\u0635\u0646\u062f\u0644\u06cc \u0628\u0627\u0642\u06cc\u200c\u0645\u0627\u0646\u062f\u0647"}</span> : null}
          </div>          {props.summary ? <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted">{props.summary}</p> : null}
          <div className="mt-3 flex flex-col gap-2 border-t border-brand/10 pt-3 sm:flex-row">
            <CartAddButton className="min-w-0 flex-1" buttonClassName="!min-h-10 text-xs sm:text-sm" itemType="flight" travelServiceId={props.id} />
          <button
            aria-pressed={selected}
            className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl px-4 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent ${selected ? "bg-emerald-600 hover:bg-emerald-700" : "bg-accent-strong hover:-translate-y-0.5 hover:bg-brand"}`}
            onClick={selectTicket}
            type="button"
          >
            {selected ? `${directionLabel} انتخاب شد` : "انتخاب بلیت"}
          </button>
          </div>
        </div>
        <div className="flex flex-col justify-start gap-3 border-t-2 border-brand/15 bg-surface-muted/85 p-4 lg:border-r-2 lg:border-t-0">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted lg:grid-cols-1">
            <span className="inline-flex items-center gap-2">
              <ClockIcon className="size-4 text-brand" />
              {props.stopsCount ? `${props.stopsCount.toLocaleString("fa-IR")} توقف` : "بدون توقف"}
            </span>
            <span className="inline-flex items-center gap-2">
              <SuitcaseIcon className="size-4 text-brand" />
              {formatBaggageAllowance(props.baggage)}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted">قیمت هر مسافر</span>
            <strong className="mt-1 block text-lg text-brand">
              {price}
            </strong>
          </div>
          <RefundPolicyButton policy={props.refundPolicy} />

        </div>
      </div>
    </article>
  );
}
