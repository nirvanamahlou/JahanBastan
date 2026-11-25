"use client";

import { useState } from "react";
import { ErpFlightResultCard, type ErpFlightRate } from "@/components/content/erp-flight-result-card";
import { formatPersianDateTime } from "@/lib/persian-date";
import type { PassengerCounts } from "@/lib/tour-passenger-counts";

const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tehran" });

export function ErpRoundTripPicker({ flights, passengerCounts, resultsSearch }: { flights: ErpFlightRate[]; passengerCounts: PassengerCounts; resultsSearch: string }) {
  const [outbound, setOutbound] = useState("");
  const [returnDay, setReturnDay] = useState("");
  const [pair, setPair] = useState("");
  const groups = new Map<string, ErpFlightRate[]>();
  for (const flight of flights) {
    if (!flight.return_leg) continue;
    const group = groups.get(flight.product_id);
    if (group) group.push(flight);
    else groups.set(flight.product_id, [flight]);
  }
  const returns = [...(groups.get(outbound) ?? [])].sort((a, b) => Date.parse(a.return_leg!.departure) - Date.parse(b.return_leg!.departure));
  const returnDays = [...new Set(returns.map((flight) => dateKey.format(new Date(flight.return_leg!.departure))))];
  const day = returnDays.includes(returnDay) ? returnDay : returnDays[0];
  const selected = returns.find((flight) => flight.product_ids.join("/") === pair);
  const button = "min-h-11 rounded-xl border border-brand/20 bg-surface p-3 text-start text-sm font-bold text-brand hover:bg-brand-soft";

  if (!groups.size) return null;
  return (
    <section className="grid gap-3" aria-label="انتخاب پرواز رفت و برگشت آوینا">
      <div className="depth-box grid gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-brand">{returns.length ? "انتخاب بلیت برگشت آوینا" : "انتخاب بلیت رفت آوینا"}</h3>
          {returns.length ? <button type="button" className="text-sm font-bold underline" onClick={() => { setOutbound(""); setPair(""); }}>تغییر پرواز رفت</button> : null}
        </div>
        {returns.length ? (
          <>
            <p className="text-sm">{returns[0].origin} به {returns[0].destination} · {formatPersianDateTime(returns[0].departure)}</p>
            <div className="flex flex-wrap gap-2" aria-label="روزهای دارای پرواز برگشت">
              {returnDays.map((date) => (
                <button key={date} type="button" aria-pressed={day === date} className="rounded-lg bg-[#fce5ef] px-3 py-2 text-sm text-[#651b43] aria-pressed:ring-2 aria-pressed:ring-[#b52c73]" onClick={() => { setReturnDay(date); setPair(""); }}>
                  {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(new Date(`${date}T12:00:00Z`))}
                </button>
              ))}
            </div>
            <div className="grid gap-2">
              {returns.filter((flight) => dateKey.format(new Date(flight.return_leg!.departure)) === day).map((flight) => (
                <button
                  key={flight.product_ids.join("/")} type="button" className={`${button} aria-pressed:ring-2 aria-pressed:ring-brand`}
                  aria-pressed={selected === flight} onClick={() => setPair(flight.product_ids.join("/"))}
                >
                  {flight.return_leg!.carrier} · {formatPersianDateTime(flight.return_leg!.departure)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            {[...groups.values()].map(([flight]) => (
              <button key={flight.product_id} type="button" className={button} onClick={() => { setOutbound(flight.product_id); setReturnDay(""); setPair(""); }}>
                {flight.origin} به {flight.destination} · {flight.carrier} · {formatPersianDateTime(flight.departure)}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected ? <ErpFlightResultCard key={pair} flight={selected} passengerCounts={passengerCounts} resultsSearch={resultsSearch} /> : null}
    </section>
  );
}
