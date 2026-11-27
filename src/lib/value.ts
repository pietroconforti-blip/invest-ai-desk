import { round2 } from "@/lib/format";
import type { Book, Position } from "@/lib/ledger";
import type { Quote } from "@/lib/types";

export function eurPerUnit(currency: string | null, eurusd: number | null): number | null {
  if (currency === "EUR") return 1;
  if (currency === "USD") {
    if (eurusd == null || !(eurusd > 0)) return null;
    return 1 / eurusd;
  }
  return null;
}

export type ValuedPosition = Position & {
  price: number | null;
  marketEur: number | null;
  unrealizedEur: number | null;
  weight: number | null;
  changePercent: number | null;
};

export type Valuation = {
  cash: number;
  equity: number;
  invested: number;
  unrealized: number;
  positions: ValuedPosition[];
  missing: string[];
  complete: boolean;
};

export function valueBook(book: Book, quotes: Map<string, Quote>, eurusd: number | null): Valuation {
  const raw: Omit<ValuedPosition, "weight">[] = book.positions.map((position) => {
    const quote = quotes.get(position.symbol);
    const fx = quote ? eurPerUnit(quote.currency ?? position.currency, eurusd) : null;
    const price = quote?.price ?? null;
    if (price == null || fx == null) {
      return {
        ...position,
        price,
        marketEur: null,
        unrealizedEur: null,
        changePercent: quote?.changePercent ?? null,
      };
    }
    const marketEur = round2(position.qty * price * fx);
    return {
      ...position,
      price,
      marketEur,
      unrealizedEur: round2(marketEur - position.costEur),
      changePercent: quote?.changePercent ?? null,
    };
  });

  const missing = raw.filter((row) => row.marketEur == null).map((row) => row.symbol);
  const invested = round2(raw.reduce((sum, row) => sum + (row.marketEur ?? row.costEur), 0));
  const equity = round2(book.cash + invested);
  const unrealized = round2(raw.reduce((sum, row) => sum + (row.unrealizedEur ?? 0), 0));
  const positions = raw.map((row) => ({
    ...row,
    weight: row.marketEur != null && equity > 0 ? row.marketEur / equity : null,
  }));

  return {
    cash: book.cash,
    equity,
    invested,
    unrealized,
    positions,
    missing,
    complete: missing.length === 0,
  };
}
