"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeftIcon,
  BusIcon,
  PlaneIcon,
  TrainIcon,
} from "@/components/layout/site-icons";
import { FlightCartAddButton } from "@/components/customer-commerce-actions";
import { formatCurrency } from "@/lib/currency";

type TransportKind = "flight" | "train" | "bus";
export type TicketDirection = "outbound" | "return";

export type TicketSelection = {
  key: string;
  direction: TicketDirection;
  title: string;
  provider: string | null;
  origin: string;
  destination: string;
  departureTime: string | null;
  arrivalTime: string | null;
  price: string | null;
  currency: string;
  travelServiceId: number;
};

type TicketSelectionContextValue = {
  activeLeg: TicketDirection;
  isSelected: (ticketKey: string) => boolean;
  roundTrip: boolean;
  selectLeg: (leg: TicketDirection) => void;
  selectTicket: (ticket: TicketSelection) => void;
  focusTicket: (ticket: TicketSelection) => void;
};

const TicketSelectionContext = createContext<TicketSelectionContextValue | null>(null);

function time(value: string | null) {
  return value?.slice(0, 5) ?? "اعلام می‌شود";
}

function SelectedTicketSummary({
  active,
  disabled,
  label,
  onSelect,
  ticket,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  ticket: TicketSelection | null;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-w-0 rounded-2xl border p-3 text-right transition focus-visible:ring-4 focus-visible:ring-accent ${ticket ? "border-emerald-200 bg-emerald-50/70" : "border-dashed border-border bg-white/70"} ${active ? "ring-2 ring-brand/20" : ""} disabled:cursor-not-allowed disabled:opacity-55`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <p className="text-xs font-black text-brand">{label}</p>
      {ticket ? (
        <>
          <p className="mt-2 truncate text-sm font-black text-foreground">
            {ticket.provider || ticket.title}
          </p>
          <p className="mt-1 text-xs text-muted">
            {ticket.origin} ← {ticket.destination}
          </p>
          <p className="mt-2 text-xs font-bold text-brand">
            {time(ticket.departureTime)} تا {time(ticket.arrivalTime)} · {ticket.price
              ? formatCurrency(ticket.price, ticket.currency)
              : "استعلام"}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">هنوز انتخاب نشده است.</p>
      )}
    </button>
  );
}

export function TicketSelectionProvider({
  children,
  kind,
  roundTrip,
}: {
  children: ReactNode;
  kind: TransportKind;
  roundTrip: boolean;
}) {
  const [outbound, setOutbound] = useState<TicketSelection | null>(null);
  const [inbound, setInbound] = useState<TicketSelection | null>(null);
  const [activeLeg, setActiveLeg] = useState<TicketDirection>("outbound");
  const kindLabel = kind === "flight" ? "پرواز" : kind === "train" ? "قطار" : "اتوبوس";
  const KindIcon = kind === "flight" ? PlaneIcon : kind === "train" ? TrainIcon : BusIcon;
  // One-way mode deliberately ignores any previously selected inbound ticket.
  const visibleActiveLeg: TicketDirection = roundTrip ? activeLeg : "outbound";

  const value = useMemo<TicketSelectionContextValue>(() => ({
    activeLeg: visibleActiveLeg,
    roundTrip,
    isSelected: (ticketKey) => (
      outbound?.key === ticketKey || (roundTrip && inbound?.key === ticketKey)
    ),
    selectLeg: (leg) => {
      if (!roundTrip || (leg === "return" && !outbound)) return;
      setActiveLeg(leg);
    },
    focusTicket: (ticket) => {
      if (roundTrip && ticket.direction === "return" && !outbound) return;
      setActiveLeg(roundTrip ? ticket.direction : "outbound");
      window.requestAnimationFrame(() => {
        document.getElementById(`ticket-card-${ticket.key}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    selectTicket: (ticket) => {
      if (roundTrip && ticket.direction !== activeLeg) return;
      if (!roundTrip || ticket.direction === "outbound") {
        setOutbound(ticket);
        setInbound(null);
        if (roundTrip) setActiveLeg("return");
        return;
      }
      setInbound(ticket);
    },
  }), [activeLeg, inbound, outbound, roundTrip, visibleActiveLeg]);

  return (
    <TicketSelectionContext.Provider value={value}>
      {roundTrip ? (
        <section
          aria-live="polite"
          className="flight-interactive-panel mb-5 rounded-3xl border-2 border-brand/25 bg-surface-muted/90 p-4 shadow-[0_10px_26px_rgba(1,37,105,0.07)] sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black text-brand">
                <KindIcon className="size-4" /> انتخاب بلیت رفت‌وبرگشت
              </p>
              <h3 className="mt-1 text-lg font-black text-foreground">
                هر بلیت را جداگانه انتخاب کنید
              </h3>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${activeLeg === "outbound" ? "bg-brand text-white" : "bg-accent text-brand"}`}>
              {activeLeg === "outbound"
                ? `۱. انتخاب ${kindLabel} رفت`
                : `۲. انتخاب ${kindLabel} برگشت`}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectedTicketSummary
              active={activeLeg === "outbound"}
              label="بلیت رفت"
              onSelect={() => outbound ? value.focusTicket(outbound) : setActiveLeg("outbound")}
              ticket={outbound}
            />
            <SelectedTicketSummary
              active={activeLeg === "return"}
              disabled={!outbound}
              label="بلیت برگشت"
              onSelect={() => inbound ? value.focusTicket(inbound) : setActiveLeg("return")}
              ticket={inbound}
            />
          </div>
          {inbound && outbound ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white">
              <p className="flex items-center gap-2"><ArrowLeftIcon className="size-4" /> بلیت رفت و برگشت انتخاب شد؛ هر کارت را برای تغییر انتخاب کنید.</p>
              <FlightCartAddButton className="shrink-0" idleLabel="خرید بلیط رفت‌وبرگشت" successLabel="هر دو بلیط انتخاب شد" travelServiceIds={[outbound.travelServiceId, inbound.travelServiceId]} />
            </div>
          ) : null}
        </section>
      ) : null}
      {children}
    </TicketSelectionContext.Provider>
  );
}

export function useTicketSelection() {
  const value = useContext(TicketSelectionContext);
  if (!value) {
    throw new Error("useTicketSelection must be used within TicketSelectionProvider");
  }
  return value;
}