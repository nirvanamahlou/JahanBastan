import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/payment/order-payment-status.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
async function load(kind, responses) {
  const api = {};
  runInNewContext(js, {exports: api, require: () => ({PUBLIC_API_BASE_URL: "", formatCurrency: String}),
    fetch: async (path, options) => {
      assert.equal(options.credentials, "include");
      assert.equal(options.cache, "no-store");
      assert.ok(Object.hasOwn(responses, path), path);
      return Response.json(responses[path]);
    }});
  return api.loadOrder({kind, id: "1"}, new AbortController().signal);
}
const booking = {bookingNumber: "JB-123", status: "approved", totalAmount: "200", payableNowAmount: "50", currency: "IRT", items: [], paymentMethod: "installment"};
test("only active gateways offer the approved amount due for this booking", async () => {
  for (const enabled of [true, false]) {
    const view = await load("booking", {"/account/bookings/1": booking, "/payments/configuration": {enabled}});
    assert.equal(view.payable, enabled ? 50 : undefined);
  }
  for (const status of ["pending_review", "expired", "paid", "cancelled", "rejected"]) {
    const view = await load("booking", {"/account/bookings/1": {...booking, status}});
    assert.equal(view.payable, undefined);
  }
});
test("flight settlement is scoped to its order and never initiates a gateway payment", async () => {
  const path = "/account/erp-flight-checkouts/1";
  const view = await load("flight", {[path]: {state:"draft", contractNumber:"42",routeLabel:"IKA → IST"},
    [path+"/details"]: {totals:[{amount:"100",currency:"IRR"}]}, [path+"/settlement"]: {state:"settled"}});
  assert.match(view.next, /تأیید شده/);
  assert.equal(view.reference, "42");
  assert.equal(view.title, "IKA → IST");
  assert.equal(view.payable, undefined);
});
