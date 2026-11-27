import assert from "node:assert/strict";
import { test } from "node:test";
import type { Quote } from "./types.ts";
import { reviewOrder, commitOrder } from "./order-logic.ts";
import type { StoredFill } from "./ledger.ts";

function quote(partial: Partial<Quote> = {}): Quote {
  return {
    symbol: "VWCE.DE",
    name: "Vanguard FTSE All-World",
    currency: "EUR",
    price: 100,
    changePercent: 0.4,
    previousClose: 99.6,
    dayHigh: 101,
    dayLow: 99,
    yearHigh: 140,
    yearLow: 90,
    volume: 1000,
    exchange: "XETRA",
    time: 1_700_000_000,
    history: [90, 100],
    historyReturn: 11,
    kind: "etf",
    ...partial,
  };
}

const now = 1_700_000_000_000;

test("a €10 review is accepted and a €11 review is refused", () => {
  const ok = reviewOrder({ symbol: "VWCE.DE", side: "buy", notionalEur: 10, fills: [] }, quote(), 1.1, new Map(), now);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.proposal.brokerSubmitted, false);
    assert.equal(ok.proposal.liveTrading, false);
    assert.equal(ok.proposal.notionalEur <= 10, true);
    assert.ok(ok.proposal.risks.some((line) => /not send it to a broker/i.test(line)));
  }
  const refused = reviewOrder({ symbol: "VWCE.DE", side: "buy", notionalEur: 11, fills: [] }, quote(), 1.1, new Map(), now);
  assert.equal(refused.ok, false);
});

test("an index cannot be bought", () => {
  const result = reviewOrder(
    { symbol: "^GSPC", side: "buy", notionalEur: 10, fills: [] },
    quote({ symbol: "^GSPC", kind: "index", currency: "USD" }),
    1.1,
    new Map(),
    now,
  );
  assert.equal(result.ok, false);
});

test("a price jump cancels the approval", () => {
  const reviewed = reviewOrder({ symbol: "VWCE.DE", side: "buy", notionalEur: 10, fills: [] }, quote({ price: 100 }), 1.1, new Map(), now);
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;
  const committed = commitOrder(
    {
      symbol: "VWCE.DE",
      side: "buy",
      notionalEur: 10,
      fills: [],
      proposalId: reviewed.proposal.id,
      quotedPrice: 100,
      expiresAt: reviewed.proposal.expiresAt,
    },
    quote({ price: 103 }),
    1.1,
    new Map(),
    now + 1000,
  );
  assert.equal(committed.ok, false);
});

test("four buys then a fifth flags concentration and still respects cash", () => {
  const fills: StoredFill[] = [];
  let cursor = now;
  for (let i = 0; i < 4; i += 1) {
    const reviewed = reviewOrder({ symbol: "VWCE.DE", side: "buy", notionalEur: 10, fills }, quote(), 1.1, new Map(), cursor);
    assert.equal(reviewed.ok, true);
    if (!reviewed.ok) return;
    const committed = commitOrder(
      {
        symbol: "VWCE.DE",
        side: "buy",
        notionalEur: 10,
        fills,
        proposalId: reviewed.proposal.id,
        quotedPrice: reviewed.proposal.priceNative,
        expiresAt: reviewed.proposal.expiresAt,
      },
      quote(),
      1.1,
      new Map(),
      cursor + 1000,
    );
    assert.equal(committed.ok, true);
    if (committed.ok) fills.push(committed.fill);
    cursor += 2000;
  }
  const fifth = reviewOrder({ symbol: "VWCE.DE", side: "buy", notionalEur: 10, fills }, quote(), 1.1, new Map(), cursor);
  assert.equal(fifth.ok, true);
  if (fifth.ok) assert.match(fifth.proposal.risks[0] ?? "", /concentration/i);
});
