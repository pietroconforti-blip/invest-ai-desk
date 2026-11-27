import { round2, round6 } from "@/lib/format";
import {
  assertBook,
  MAX_ORDER_EUR,
  MIN_ORDER_EUR,
  type Book,
  type Side,
  type StoredFill,
} from "@/lib/ledger";
import type { OrderProposal, Quote } from "@/lib/types";
import { eurPerUnit, valueBook } from "@/lib/value";

const REVIEW_MS = 90_000;

export type OrderRequest = {
  symbol: string;
  side: Side;
  notionalEur: number;
  fills: readonly unknown[];
};

export type PlanResult = { ok: true; proposal: OrderProposal } | { ok: false; error: string };

function baseRisks(currency: string): string[] {
  const risks = [
    "Paper only. Recording this order updates the local book and does not send it to a broker.",
    "Live trading is disabled.",
    "The reference price is delayed and can differ from a live market.",
    "Approval records the order. It is not a view that the order is suitable.",
    `Each paper order is capped at €${MAX_ORDER_EUR}.`,
  ];
  if (currency !== "EUR") {
    risks.push("The euro value uses a delayed EURUSD rate, so the holding can move even if the share price does not.");
  }
  return risks;
}

function tradable(quote: Quote): string | null {
  if (quote.kind === "index" || quote.kind === "fx" || quote.symbol.startsWith("^") || quote.symbol.includes("=")) {
    return "Indexes and currency pairs stay on the market strip. They are not added to the paper book.";
  }
  if (quote.price == null || !(quote.price > 0)) return "No usable price is available for this listing.";
  return null;
}

function plan(input: OrderRequest, quote: Quote, eurusd: number | null, marks: Map<string, Quote>, now: number): PlanResult {
  const blocked = tradable(quote);
  if (blocked) return { ok: false, error: blocked };
  if (input.side !== "buy" && input.side !== "sell") return { ok: false, error: "Choose buy or sell." };

  let book: Book;
  try {
    book = assertBook(input.fills);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The paper book does not reconcile.";
    return { ok: false, error: `${message} Reset the book before recording another order.` };
  }

  const fx = eurPerUnit(quote.currency, eurusd);
  if (fx == null) return { ok: false, error: "No euro rate is available for this listing, so it cannot be sized." };

  const price = quote.price as number;
  const position = book.positions.find((row) => row.symbol === quote.symbol);
  const positionValue = position ? position.qty * price * fx : 0;
  let notional = round2(input.notionalEur);
  if (!Number.isFinite(notional) || notional <= 0) return { ok: false, error: "Enter an amount in euros." };
  if (notional > MAX_ORDER_EUR + 0.001) {
    return { ok: false, error: `The paper cap is €${MAX_ORDER_EUR}. This review was refused.` };
  }

  const closingDust = input.side === "sell" && position != null && positionValue > 0 && positionValue <= MAX_ORDER_EUR && Math.abs(notional - positionValue) / positionValue < 0.03;
  if (notional < MIN_ORDER_EUR && !closingDust) {
    return { ok: false, error: `The smallest paper order is €${MIN_ORDER_EUR}, unless you are closing a smaller holding.` };
  }
  if (closingDust) notional = round2(positionValue);

  if (input.side === "buy" && book.cash + 0.02 < notional) {
    return { ok: false, error: "Paper cash is not enough for that amount." };
  }
  if (input.side === "sell") {
    if (!position || positionValue + 0.05 < notional) {
      return { ok: false, error: "The paper position is smaller than that sale." };
    }
  }

  let qty = round6(notional / (price * fx));
  if (input.side === "sell" && position && qty > position.qty) qty = round6(position.qty);
  notional = round2(qty * price * fx);
  if (!(qty > 0) || !(notional > 0)) return { ok: false, error: "The amount is too small to size a quantity." };
  if (notional > MAX_ORDER_EUR + 0.02) {
    qty = round6(MAX_ORDER_EUR / (price * fx));
    notional = round2(qty * price * fx);
  }
  if (notional > MAX_ORDER_EUR + 0.02 || !(notional > 0)) {
    return { ok: false, error: `The paper cap is €${MAX_ORDER_EUR}. This review was refused.` };
  }
  if (input.side === "buy" && book.cash + 0.02 < notional) {
    return { ok: false, error: "Paper cash is not enough for that amount." };
  }

  const fill: StoredFill = {
    id: crypto.randomUUID(),
    symbol: quote.symbol,
    name: quote.name,
    side: input.side,
    qty,
    priceNative: price,
    currency: quote.currency || "USD",
    fxEurPerUnit: fx,
    notionalEur: notional,
    time: new Date(now).toISOString(),
    brokerSubmitted: false,
  };

  let next: Book;
  try {
    next = assertBook([...input.fills, fill]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The order does not fit the paper book.";
    return { ok: false, error: message };
  }

  const markMap = new Map(marks);
  markMap.set(quote.symbol, quote);
  const valued = valueBook(next, markMap, eurusd);
  const held = next.positions.find((row) => row.symbol === quote.symbol);
  const weight = held && valued.equity > 0 ? (held.qty * price * fx) / valued.equity : 0;
  const risks = baseRisks(fill.currency);
  if (weight > 0.35) {
    risks.unshift(
      `This listing would be about ${Math.round(weight * 100)}% of paper equity. That is a high concentration for one name.`,
    );
  }

  const proposal: OrderProposal = {
    id: fill.id,
    symbol: fill.symbol,
    name: fill.name,
    side: fill.side,
    qty: fill.qty,
    priceNative: fill.priceNative,
    currency: fill.currency,
    fxEurPerUnit: fill.fxEurPerUnit,
    notionalEur: fill.notionalEur,
    cashAfter: next.cash,
    positionQtyAfter: held?.qty ?? 0,
    equityAfterEstimate: valued.complete ? valued.equity : null,
    risks,
    expiresAt: now + REVIEW_MS,
    mode: "local-paper",
    liveTrading: false,
    brokerSubmitted: false,
  };
  return { ok: true, proposal };
}

export function reviewOrder(
  input: OrderRequest,
  quote: Quote,
  eurusd: number | null,
  marks: Map<string, Quote>,
  now = Date.now(),
): PlanResult {
  return plan(input, quote, eurusd, marks, now);
}

export function commitOrder(
  input: OrderRequest & { proposalId: string; quotedPrice: number; expiresAt: number },
  quote: Quote,
  eurusd: number | null,
  marks: Map<string, Quote>,
  now = Date.now(),
): { ok: true; fill: StoredFill } | { ok: false; error: string } {
  if (now > input.expiresAt) {
    return { ok: false, error: "This review expired. Prepare it again for a fresh price." };
  }
  if (!(input.quotedPrice > 0) || quote.price == null) {
    return { ok: false, error: "No usable price is available for this listing." };
  }
  const drift = Math.abs(quote.price - input.quotedPrice) / input.quotedPrice;
  if (drift > 0.015) {
    return {
      ok: false,
      error: "The price moved more than 1.5% since review. The order was not recorded. Review the new price.",
    };
  }
  const planned = plan(input, quote, eurusd, marks, now);
  if (!planned.ok) return planned;
  if (planned.proposal.id && input.proposalId && planned.proposal.notionalEur > MAX_ORDER_EUR + 0.02) {
    return { ok: false, error: `The paper cap is €${MAX_ORDER_EUR}. This order was refused.` };
  }
  const fill: StoredFill = {
    id: input.proposalId,
    symbol: planned.proposal.symbol,
    name: planned.proposal.name,
    side: planned.proposal.side,
    qty: planned.proposal.qty,
    priceNative: planned.proposal.priceNative,
    currency: planned.proposal.currency,
    fxEurPerUnit: planned.proposal.fxEurPerUnit,
    notionalEur: planned.proposal.notionalEur,
    time: new Date(now).toISOString(),
    brokerSubmitted: false,
  };
  try {
    assertBook([...input.fills, fill]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The order does not fit the paper book.";
    return { ok: false, error: message };
  }
  return { ok: true, fill };
}
