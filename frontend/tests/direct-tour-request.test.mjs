import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/direct-tour-request.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });

function load(sessionStorage) {
  const exports = {};
  runInNewContext(outputText, { exports, crypto: webcrypto, sessionStorage, TextEncoder });
  return exports;
}

test("uncertain direct bookings reuse the request key after reload without storing traveler details", async () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const body = JSON.stringify({ firstName: "Example Traveler", acceptedTotalIrt: 430 });
  const first = await load(storage).pendingDirectTourRequest(12, body);
  const retry = load(storage);
  assert.equal((await retry.pendingDirectTourRequest(12, body)).requestKey, first.requestKey);
  assert.notEqual((await retry.pendingDirectTourRequest(13, body)).requestKey, first.requestKey);
  assert.notEqual((await retry.pendingDirectTourRequest(12, body.replace("430", "500"))).requestKey, first.requestKey);
  assert.notEqual((await retry.pendingDirectTourRequest(12, body.replace("Example Traveler", "Second Traveler"))).requestKey, first.requestKey);
  assert.ok([...values].flat().every(text => !text.includes("Traveler") && !text.includes("acceptedTotalIrt")));
  retry.finishDirectTourRequest(first);
  assert.notEqual((await load(storage).pendingDirectTourRequest(12, body)).requestKey, first.requestKey);
});

test("a pending confirmation is stable when session storage is disabled", async () => {
  const denied = () => { throw new Error("unavailable"); };
  const { pendingDirectTourRequest, finishDirectTourRequest } = load({ getItem: denied, setItem: denied, removeItem: denied });
  const first = await pendingDirectTourRequest(1, "payload");
  assert.equal(first.requestKey, (await pendingDirectTourRequest(1, "payload")).requestKey);
  finishDirectTourRequest(first);
  assert.notEqual(first.requestKey, (await pendingDirectTourRequest(1, "payload")).requestKey);
});

test("a missing converted total cannot be accepted as a zero price", () => {
  const { directTourAmount } = load({});
  for (const bad of [null, undefined, "", "  ", "bad", Infinity, -1, false]) assert.equal(directTourAmount(bad), null);
  assert.equal(directTourAmount("1050.00"), 1050);
  assert.equal(directTourAmount(0), null);
});
