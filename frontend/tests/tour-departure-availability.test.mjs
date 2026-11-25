import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

// Run the real component render/handlers without a browser or extra test library.
function componentHarness() {
  let states = [];
  let cursor = 0;
  const listeners = new Map();
  const events = [];
  const cache = new Map();
  const react = {
    useMemo: (factory) => factory(),
    useEffect: (effect) => effect(),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
  };
  const window = {
    location: { href: "https://example.test/tours/sample/?lang=fa#tour-booking" },
    history: { replaceState(_state, _unused, path) { window.location.href = new URL(path, window.location.href).href; } },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (event) => events.push(event),
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const compiled = { exports: {} };
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    const modules = { react, "react/jsx-runtime": jsxRuntime };
    const requireModule = (name) => {
      if (name in modules) return modules[name];
      if (name === "./tour-price-breakdown") return load("components/content/tour-price-breakdown.tsx");
      if (["@/lib/tour-departure-availability", "@/lib/currency-conversion", "@/lib/currency", "@/lib/persian-date"].includes(name)) {
        return load(`${name.slice(2)}.ts`);
      }
      return new Proxy({}, { get: () => () => null });
    };
    runInNewContext(outputText, {
      module: compiled, exports: compiled.exports, require: requireModule, window, URL,
      CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    });
    cache.set(file, compiled.exports);
    return compiled.exports;
  }
  return {
    load, events, listeners, window,
    render(Component, props, reset = false) {
      cursor = 0;
      if (reset) states = [];
      return Component(props);
    },
  };
}

function elements(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((item) => elements(item, predicate));
  return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}

function departure(id, bookingStatus = "open", capacityRemaining = null) {
  return {
    id, bookingStatus, capacityRemaining, label: `Date ${id}`, departureDate: `2026-09-${10 + id}`,
    priceAmount: "100", currency: "IRT", canBook: true, flightDetails: `Flight ${id}`,
    hotelPrices: [{
      id, hotel: { id, name: `Hotel ${id}`, slug: `hotel-${id}`, starRating: 3, galleryImageIds: [] },
      doublePrice: "100", singlePrice: "200", packageCurrency: "IRT", flightPricePerPerson: "0",
      flightCurrency: "IRT", isAvailable: true, capacityRemaining: null,
    }],
  };
}

test("an explicitly selected departure is never silently replaced when availability changes", () => {
  const harness = componentHarness();
  const { TourHotelFilter } = harness.load("components/content/tour-hotel-filter.tsx");
  const props = { tourId: 1, tourSlug: "test", exchangeRates: {}, isInstallmentAvailable: false };
  const departures = [departure(1, "closed"), departure(2, "sold_out"), departure(3, "open", 0), departure(4), departure(5)];
  const hotelIds = (dates) => elements(harness.render(TourHotelFilter, { ...props, departures: dates }), (node) => node.type === "article").map((node) => Number(node.key));
  assert.deepEqual(hotelIds(departures), [4]);
  harness.listeners.get("tour-departure-selected")({ detail: { departureId: 1 } });
  assert.deepEqual(hotelIds(departures), []);
  harness.listeners.get("tour-departure-selected")({ detail: { departureId: 4 } });
  assert.deepEqual(hotelIds(departures), [4]);
  const closed = departures.map((date) => date.id === 4 ? { ...date, bookingStatus: "closed" } : date);
  assert.deepEqual(hotelIds(closed), []);
  assert.deepEqual(hotelIds(closed.map((date) => ({ ...date, bookingStatus: "closed" }))), []);
  assert.deepEqual(hotelIds([departure(4)]), [4]);
});

test("tour breakdown matches the published per-person conversion for mixed selections and missing rates", () => {
  const harness = componentHarness();
  const { summarizeTourPrice } = harness.load("lib/currency-conversion.ts");
  const summary = summarizeTourPrice([
    { amount: "196", currency: "EUR", quantity: 1 },
    { amount: "48900000", currency: "IRT", quantity: 1 },
  ], { eurToIrt: 293000 });
  assert.equal(summary.total, 106328000);
  assert.equal(summary.foreign[0].rate, 293000);
  assert.equal(summary.foreign[0].toman, 57428000);
  assert.equal(summary.local, 48900000);

  const mixed = [
    { amount: "9.1", currency: "USD", quantity: 2 },
    { amount: "1.4", currency: "USD", quantity: 1 },
    { amount: "15", currency: "IRR", quantity: 2 },
    { amount: "40", currency: "EUR", quantity: 1 },
  ];
  const complete = summarizeTourPrice(mixed, { usdToIrt: 1.15, eurToIrt: 3 });
  assert.equal(complete.foreign[0].amount, 22);
  assert.equal(complete.foreign[0].toman, 27);
  assert.equal(complete.total, 151);
  assert.equal(summarizeTourPrice(mixed, { eurToIrt: 3 }).total, null);
  assert.equal(summarizeTourPrice(mixed, {}).foreign[0].rate, null);
});

test("calendar and hotel picks persist the exact ID without losing other URL parameters", () => {
  const h = componentHarness();
  const dates = [departure(1), departure(2)];
  const calendar = h.render(h.load("components/content/tour-departure-calendar.tsx").TourDepartureCalendar, { departures: dates, initialDepartureId: 2 });
  const selected = elements(calendar, n => n.type === "button" && n.props["aria-pressed"] === true);
  assert.equal(selected.length, 1);
  selected[0].props.onClick();
  assert.equal(h.window.location.href, "https://example.test/tours/sample/?lang=fa&departureId=2#tour-dates");
  const props = { departures: dates, initialDepartureId: 2, tourId: 1, tourSlug: "test", exchangeRates: {}, isInstallmentAvailable: false };
  const Hotel = h.load("components/content/tour-hotel-filter.tsx").TourHotelFilter;
  const hotels = h.render(Hotel, props, true);
  assert.deepEqual(elements(hotels, n => n.type === "article").map(n => Number(n.key)), [2]);
  elements(hotels, n => n.props.options && typeof n.props.onSelect === "function")[0].props.onSelect(1);
  assert.equal(new URL(h.window.location.href).searchParams.get("departureId"), "1");
  const stale = h.render(Hotel, { ...props, initialDepartureId: 999 }, true);
  assert.equal(elements(stale, n => n.type === "article").length, 0);
  assert.ok(elements(stale, n => n.props.role === "status").length);
});

test("catalogue sale dates require a usable dated offer and derive missing return dates in UTC", () => {
  const { hasBookableTourPackage, tourReturnDate } = componentHarness().load("lib/tour-departure-availability.ts");
  assert.equal(hasBookableTourPackage(departure(4)), true);
  assert.equal(hasBookableTourPackage(departure(4, "sold_out")), false);
  const empty = { ...departure(4), hotelPrices: [] };
  assert.equal(hasBookableTourPackage(empty), false);
  const offer = { departureId: 4, doublePrice: "42", singlePrice: null, regularFlightPrice: "0" };
  assert.equal(hasBookableTourPackage(empty, [{ departurePrices: [offer] }]), true);
  assert.equal(hasBookableTourPackage(empty, [{ departurePrices: [{ ...offer, regularFlightPrice: null }] }]), false);
  assert.equal(tourReturnDate("2026-11-30", null, 7), "2026-12-07");
  assert.equal(tourReturnDate("2026-11-30", "2026-12-08", 7), "2026-12-08");
  assert.equal(tourReturnDate("2026-11-30", null), null);
});
