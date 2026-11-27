import { round2, round6 } from "@/lib/format";

export const STARTING_CAPITAL_EUR = 50;
export const MAX_ORDER_EUR = 10;
export const MIN_ORDER_EUR = 1;

export type Side = "buy" | "sell";

export type StoredFill = {
  id: string;
  symbol: string;
  name: string;
  side: Side;
  qty: number;
  priceNative: number;
  currency: string;
  fxEurPerUnit: number;
  notionalEur: number;
  time: string;
  brokerSubmitted: false;
};

export type Position = {
  symbol: string;
  name: string;
  currency: string;
  qty: number;
  costEur: number;
};

export type LedgerEvent = StoredFill & {
  realizedEur: number;
  cashAfter: number;
};

export type Book = {
  cash: number;
  positions: Position[];
  realized: number;
  events: LedgerEvent[];
};

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string): never {
  throw new Error(message);
}

function asFill(value: unknown): StoredFill {
  if (!value || typeof value !== "object") fail("A stored fill is unreadable.");
  const row = value as Record<string, unknown>;
  const side = row.side;
  if (side !== "buy" && side !== "sell") fail("A stored fill has no side.");
  if (row.brokerSubmitted !== false) fail("Live routing is disabled.");
  if (typeof row.id !== "string" || !ID_RE.test(row.id)) fail("A stored fill has a bad id.");
  if (typeof row.symbol !== "string" || !row.symbol.trim()) fail("A stored fill has no symbol.");
  if (typeof row.name !== "string") fail("A stored fill has no name.");
  if (typeof row.currency !== "string" || !row.currency) fail("A stored fill has no currency.");
  if (typeof row.time !== "string") fail("A stored fill has no time.");
  const qty = row.qty;
  const priceNative = row.priceNative;
  const fxEurPerUnit = row.fxEurPerUnit;
  const notionalEur = row.notionalEur;
  if (typeof qty !== "number" || typeof priceNative !== "number") fail("A stored fill has a bad price.");
  if (typeof fxEurPerUnit !== "number" || typeof notionalEur !== "number") {
    fail("A stored fill has a bad euro amount.");
  }
  if (!(qty > 0) || !(priceNative > 0) || !(fxEurPerUnit > 0)) fail("A stored fill has a non-positive price.");
  if (!(notionalEur > 0) || notionalEur > MAX_ORDER_EUR + 0.02) {
    fail(`A stored fill breaks the €${MAX_ORDER_EUR} paper cap.`);
  }
  const implied = qty * priceNative * fxEurPerUnit;
  if (Math.abs(implied - notionalEur) > 0.08) fail("A stored fill does not reconcile.");
  return {
    id: row.id,
    symbol: row.symbol.trim().toUpperCase(),
    name: row.name.slice(0, 80),
    side,
    qty: round6(qty),
    priceNative,
    currency: row.currency,
    fxEurPerUnit,
    notionalEur: round2(notionalEur),
    time: row.time,
    brokerSubmitted: false,
  };
}

export function assertBook(fills: readonly unknown[]): Book {
  if (!Array.isArray(fills)) fail("The paper book is unreadable.");
  if (fills.length > 300) fail("The paper book is too long to trust.");
  let cash = STARTING_CAPITAL_EUR;
  let realized = 0;
  const positions = new Map<string, Position>();
  const seen = new Set<string>();
  const events: LedgerEvent[] = [];

  for (const raw of fills) {
    const fill = asFill(raw);
    if (seen.has(fill.id)) fail("The paper book repeats an order.");
    seen.add(fill.id);
    const current = positions.get(fill.symbol);

    if (fill.side === "buy") {
      if (cash + 0.02 < fill.notionalEur) fail("The paper book spends cash it does not have.");
      cash = round2(cash - fill.notionalEur);
      const next: Position = current
        ? {
            ...current,
            qty: round6(current.qty + fill.qty),
            costEur: round2(current.costEur + fill.notionalEur),
            name: fill.name || current.name,
          }
        : {
            symbol: fill.symbol,
            name: fill.name,
            currency: fill.currency,
            qty: fill.qty,
            costEur: fill.notionalEur,
          };
      if (current && current.currency !== fill.currency) fail("A listing changed currency inside the book.");
      positions.set(fill.symbol, next);
      events.push({ ...fill, realizedEur: 0, cashAfter: cash });
      continue;
    }

    if (!current || current.qty + 1e-8 < fill.qty) fail("A sell is larger than the paper position.");
    const avg = current.costEur / current.qty;
    const costRemoved = round2(avg * fill.qty);
    const pnl = round2(fill.notionalEur - costRemoved);
    const qtyLeft = round6(current.qty - fill.qty);
    cash = round2(cash + fill.notionalEur);
    realized = round2(realized + pnl);
    if (qtyLeft <= 1e-6) positions.delete(fill.symbol);
    else {
      positions.set(fill.symbol, {
        ...current,
        qty: qtyLeft,
        costEur: round2(Math.max(0, current.costEur - costRemoved)),
      });
    }
    events.push({ ...fill, realizedEur: pnl, cashAfter: cash });
  }

  if (cash < -0.02) fail("The paper book does not reconcile.");
  return {
    cash,
    realized,
    positions: [...positions.values()].filter((p) => p.qty > 1e-6),
    events,
  };
}
