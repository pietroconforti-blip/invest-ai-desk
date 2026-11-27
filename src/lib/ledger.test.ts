import assert from "node:assert/strict";
import { test } from "node:test";
import { round2, round6 } from "./format.ts";
import { assertBook, MAX_ORDER_EUR, STARTING_CAPITAL_EUR, type StoredFill } from "./ledger.ts";

function fill(partial: Pick<StoredFill, "side" | "notionalEur" | "priceNative" | "fxEurPerUnit"> & Partial<StoredFill>): StoredFill {
  const qty = partial.qty ?? round6(partial.notionalEur / (partial.priceNative * partial.fxEurPerUnit));
  return {
    id: partial.id ?? crypto.randomUUID(),
    symbol: partial.symbol ?? "VWCE.DE",
    name: partial.name ?? "Vanguard",
    side: partial.side,
    qty,
    priceNative: partial.priceNative,
    currency: partial.currency ?? "EUR",
    fxEurPerUnit: partial.fxEurPerUnit,
    notionalEur: round2(partial.notionalEur),
    time: partial.time ?? "2026-11-27T12:00:00.000Z",
    brokerSubmitted: false,
  };
}

test("an empty book is the starting cash", () => {
  const book = assertBook([]);
  assert.equal(book.cash, STARTING_CAPITAL_EUR);
  assert.equal(book.positions.length, 0);
  assert.equal(book.realized, 0);
});

test("a buy reduces cash and stores cost", () => {
  const book = assertBook([fill({ side: "buy", notionalEur: 10, priceNative: 100, fxEurPerUnit: 1 })]);
  assert.equal(book.cash, 40);
  assert.equal(book.positions[0]?.qty, 0.1);
  assert.equal(book.positions[0]?.costEur, 10);
});

test("a sale realizes the difference from average cost", () => {
  const bought = fill({ side: "buy", notionalEur: 10, priceNative: 100, fxEurPerUnit: 1 });
  const sold = fill({ side: "sell", notionalEur: 5, priceNative: 110, fxEurPerUnit: 1, symbol: "VWCE.DE" });
  const book = assertBook([bought, sold]);
  assert.equal(book.cash, 45);
  assert.equal(book.realized, round2(5 - (10 / 0.1) * sold.qty));
  assert.ok(book.positions[0] && book.positions[0].qty < 0.1);
});

test("orders above the paper cap are refused", () => {
  assert.throws(
    () => assertBook([fill({ side: "buy", notionalEur: MAX_ORDER_EUR + 1, priceNative: 10, fxEurPerUnit: 1 })]),
    /paper cap/,
  );
});

test("a sale without a position is refused", () => {
  assert.throws(() => assertBook([fill({ side: "sell", notionalEur: 5, priceNative: 10, fxEurPerUnit: 1 })]), /larger than the paper position/);
});

test("live routing is refused", () => {
  const row = fill({ side: "buy", notionalEur: 10, priceNative: 10, fxEurPerUnit: 1 });
  assert.throws(() => assertBook([{ ...row, brokerSubmitted: true }]), /Live routing/);
});
