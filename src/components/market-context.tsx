import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadMarket } from "@/lib/api.functions";
import { assertBook } from "@/lib/ledger";
import { DEFAULT_WATCHLIST } from "@/lib/listings";
import { usePortfolio } from "@/lib/portfolio";
import type { MarketPayload, Quote } from "@/lib/types";
import { valueBook, type Valuation } from "@/lib/value";
import type { Book } from "@/lib/ledger";

type MarketContextValue = ReturnType<typeof useQuery<MarketPayload>>;

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const hydrated = usePortfolio((state) => state.hydrated);
  const watchlist = usePortfolio((state) => state.watchlist);
  const fills = usePortfolio((state) => state.fills);
  const recordEquity = usePortfolio((state) => state.recordEquity);
  const symbols = useMemo(() => {
    const base = (hydrated ? watchlist : DEFAULT_WATCHLIST).map((item) => item.symbol);
    return [...new Set([...base, ...fills.map((fill) => fill.symbol)])];
  }, [hydrated, watchlist, fills]);
  const query = useQuery({
    queryKey: ["market", symbols.join(",")],
    queryFn: () => loadMarket({ data: { symbols } }),
    refetchInterval: 60_000,
  });

  const valuation = useMemo(() => {
    try {
      const book = assertBook(fills);
      const quotes = new Map((query.data?.quotes ?? []).map((quote) => [quote.symbol, quote]));
      return valueBook(book, quotes, query.data?.eurusd ?? null);
    } catch {
      return null;
    }
  }, [fills, query.data]);

  useEffect(() => {
    if (!hydrated || !valuation?.complete || !query.data) return;
    recordEquity(valuation.equity);
  }, [hydrated, valuation?.complete, valuation?.equity, query.data?.fetchedAt, recordEquity, query.data]);

  return <MarketContext.Provider value={query}>{children}</MarketContext.Provider>;
}

export function useMarketQuery() {
  const query = useContext(MarketContext);
  if (!query) throw new Error("Market data is only available inside the desk.");
  return query;
}

export function useDesk(): {
  quotes: Map<string, Quote>;
  book: Book | null;
  bookError: string | null;
  valuation: Valuation | null;
} {
  const query = useMarketQuery();
  const fills = usePortfolio((state) => state.fills);
  const resolved = useMemo(() => {
    try {
      return { book: assertBook(fills), bookError: null as string | null };
    } catch (err) {
      return {
        book: null,
        bookError: err instanceof Error ? err.message : "The paper book could not be read.",
      };
    }
  }, [fills]);
  const quotes = useMemo(() => new Map((query.data?.quotes ?? []).map((quote) => [quote.symbol, quote])), [query.data]);
  const valuation = resolved.book ? valueBook(resolved.book, quotes, query.data?.eurusd ?? null) : null;
  return { quotes, book: resolved.book, bookError: resolved.bookError, valuation };
}
