import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/passenger-checkout-modal.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("modal.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const modal = ast.statements.find(node => node.name?.text === "PassengerCheckoutModal");
const save = modal.body.statements.find(node => node.name?.text === "saveAndContinue");
const script = ts.transpileModule(save.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test("when the live load rejects the group, no buyer or passenger is written", async () => {
  const calls = [];
  const notices = [];
  const context = {
    passengers: [{ birthDate: "1990-01-01" }, { birthDate: "2020-01-01" }],
    tooManySeats: false, availableSeats: null, buyerContact: null,
    validate: () => true, setBusy() {}, setNotice: message => notices.push(message),
    async checkFlightCapacity(dates) {
      calls.push(Array.from(dates));
      throw new Error("ظرفیت کافی نیست.");
    },
    async saveBuyerContact() { calls.push("buyer"); },
    async fetch() { calls.push("passenger"); },
    onComplete() { calls.push("completed"); },
  };
  await runInNewContext(script + "\nsaveAndContinue()", context);
  assert.deepEqual(calls, [["1990-01-01", "2020-01-01"]]);
  assert.ok(notices.at(-1));
});
