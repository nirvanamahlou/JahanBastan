import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/erp-flight-checkout-navigation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { flightCheckoutHref, parseFlightCheckoutParams } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("checkout navigation keeps the exact return flight, counts, and result filters", () => {
  const href = flightCheckoutHref({
    product_ids: ["outbound", "return"],
    origin: "تهران",
    destination: "کیش",
    departure: "2036-01-15T22:00:00Z",
    return_leg: { departure: "2036-01-20T20:55:00Z" },
  }, { adults: 1, children: 1, infants: 0 }, "?origin=Tehran&sort=price-asc");
  const url = new URL(href, "https://example.invalid");
  assert.equal(url.pathname, "/services/flights/checkout/");
  const params = Object.fromEntries(url.searchParams);
  params.product = url.searchParams.getAll("product");
  const { resultsHref, selection } = parseFlightCheckoutParams(params);
  assert.deepEqual(selection.products, ["outbound", "return"]);
  assert.deepEqual(selection.counts, { adults: 1, children: 1, infants: 0 });
  assert.equal(selection.lookup.get("departureDate"), "2036-01-16");
  assert.equal(selection.lookup.get("returnDate"), "2036-01-21");
  assert.equal(selection.lookup.get("tripType"), "round_trip");
  assert.equal(resultsHref, "/services/flights/?origin=Tehran&sort=price-asc&showResults=1");
});

test("an incomplete flight pair cannot open a checkout", () => {
  const { selection } = parseFlightCheckoutParams({
    product: "outbound",
    origin: "تهران",
    destination: "کیش",
    departureDate: "2036-01-15",
    returnDate: "2036-01-19",
  });
  assert.equal(selection, null);
});
