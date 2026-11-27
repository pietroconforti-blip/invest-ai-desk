import { createServerFn } from "@tanstack/react-start";
import { commitOrder, reviewOrder } from "@/lib/order-logic";
import { parseResearchJson } from "@/lib/research-parse";
import type { MarketPayload, Quote, ResearchReport, SearchHit } from "@/lib/types";

const SYMBOL_RE = /^[A-Z^][A-Z0-9.\-=]{0,15}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = "grok-4.5";

const recentResearch = new Map<string, number>();
const researchStamps: number[] = [];

function cleanSymbols(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const symbol = item.trim().toUpperCase();
    if (!SYMBOL_RE.test(symbol) || out.includes(symbol)) continue;
    out.push(symbol);
    if (out.length >= limit) break;
  }
  return out;
}

function gateResearch(key: string): string | null {
  const now = Date.now();
  while (researchStamps.length && now - researchStamps[0] > 3_600_000) researchStamps.shift();
  if (researchStamps.length >= 40) return "Research is paused for this hour so usage stays bounded. The market snapshot is still available.";
  const previous = recentResearch.get(key) ?? 0;
  if (now - previous < 25_000) return "A brief for this listing was just requested. Wait a moment before generating another.";
  return null;
}

function snapshotFor(quotes: Quote[], news: MarketPayload["news"], eurusd: number | null) {
  return {
    eurusd,
    listings: quotes.map((quote) => ({
      symbol: quote.symbol,
      name: quote.name,
      kind: quote.kind,
      exchange: quote.exchange,
      currency: quote.currency,
      price: quote.price,
      changePercent: quote.changePercent,
      previousClose: quote.previousClose,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      yearHigh: quote.yearHigh,
      yearLow: quote.yearLow,
      volume: quote.volume,
      historyReturnPercent: quote.historyReturn,
      historySessions: quote.history.length,
      asOfUnix: quote.time,
    })),
    headlines: news.map((item) => ({
      symbol: item.symbol,
      title: item.title,
      publisher: item.publisher,
      time: item.time,
    })),
  };
}

export const loadMarket = createServerFn({ method: "POST" })
  .validator((input: { symbols?: unknown }) => ({ symbols: cleanSymbols(input?.symbols, 16) }))
  .handler(async ({ data }): Promise<MarketPayload> => {
    const { loadMarketData } = await import("@/lib/market-data");
    return loadMarketData(data.symbols);
  });

export const searchMarket = createServerFn({ method: "POST" })
  .validator((input: { q?: unknown }) => ({ q: typeof input?.q === "string" ? input.q.trim().slice(0, 40) : "" }))
  .handler(async ({ data }): Promise<{ hits: SearchHit[] }> => {
    if (data.q.length < 1) return { hits: [] };
    const { searchSymbols } = await import("@/lib/market-data");
    try {
      return { hits: await searchSymbols(data.q) };
    } catch {
      return { hits: [] };
    }
  });

export const brokerStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    connected: false as const,
    liveTrading: false as const,
    mode: "local-paper" as const,
    message:
      "No Alpaca paper credentials are configured. No brokerage account is being read, and this app has no path that can send an order to a broker.",
  };
});

export const researchBrief = createServerFn({ method: "POST" })
  .validator((input: { symbols?: unknown }) => ({ symbols: cleanSymbols(input?.symbols, 2) }))
  .handler(async ({ data }): Promise<{ ok: true; report: ResearchReport } | { ok: false; error: string }> => {
    if (data.symbols.length < 1) return { ok: false, error: "Choose a listing first." };
    const key = data.symbols.join("|");
    const blocked = gateResearch(key);
    if (blocked) return { ok: false, error: blocked };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI research is not available in this environment. The market snapshot is still shown." };

    const { loadMarketData } = await import("@/lib/market-data");
    const market = await loadMarketData(data.symbols);
    const quotes = data.symbols
      .map((symbol) => market.quotes.find((quote) => quote.symbol === symbol))
      .filter((quote): quote is Quote => quote != null);
    if (!quotes.length) return { ok: false, error: "The feed has no price for that listing, so no brief was requested." };

    const snapshot = snapshotFor(quotes, market.news.filter((item) => data.symbols.includes(item.symbol)), market.eurusd);
    recentResearch.set(key, Date.now());
    researchStamps.push(Date.now());

    let response: Response;
    try {
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content:
                "You are the research editor for INVEST.AI, a personal paper-research desk. Use only numbers present in the market snapshot. Never invent prices, returns, valuation multiples, revenue, earnings, margins, targets, or account balances. If a figure is absent, say it was not in the feed. Separate observation from interpretation. Do not recommend a buy or a sale. Do not claim an order was placed. Respond with one JSON object and no markdown.",
            },
            {
              role: "user",
              content: `MARKET SNAPSHOT:\n${JSON.stringify(snapshot)}\n\nReturn JSON with keys headline, facts, interpretation, risks, bullCase, bearCase, newsRead, assumptions. facts must quote only snapshot numbers. bullCase and bearCase must be conditional.`,
            },
          ],
        }),
      });
    } catch {
      return { ok: false, error: "The research model did not respond. Nothing was invented in its place." };
    }
    if (!response.ok) return { ok: false, error: `The research model returned ${response.status}. Nothing was invented in its place.` };
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseResearchJson(text);
    if (!parsed) return { ok: false, error: "The research model returned an unreadable brief. Nothing was invented in its place." };
    const report: ResearchReport = {
      ...parsed,
      symbols: data.symbols,
      generatedAt: new Date().toISOString(),
      model: MODEL,
    };
    return { ok: true, report };
  });

type OrderPayload = {
  symbol: string;
  side: "buy" | "sell";
  notionalEur: number;
  fills: unknown[];
  proposalId?: string;
  quotedPrice?: number;
  expiresAt?: number;
};

function cleanOrder(input: Partial<OrderPayload> | null | undefined): OrderPayload | null {
  if (!input) return null;
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  if (!SYMBOL_RE.test(symbol)) return null;
  if (input.side !== "buy" && input.side !== "sell") return null;
  if (typeof input.notionalEur !== "number" || !Number.isFinite(input.notionalEur)) return null;
  if (!Array.isArray(input.fills)) return null;
  return {
    symbol,
    side: input.side,
    notionalEur: input.notionalEur,
    fills: input.fills.slice(0, 300),
    proposalId: typeof input.proposalId === "string" ? input.proposalId : undefined,
    quotedPrice: typeof input.quotedPrice === "number" ? input.quotedPrice : undefined,
    expiresAt: typeof input.expiresAt === "number" ? input.expiresAt : undefined,
  };
}

async function marksFor(symbols: string[]) {
  const { fetchChart } = await import("@/lib/market-data");
  const quotes = await Promise.all(symbols.map((symbol) => fetchChart(symbol, true)));
  const map = new Map<string, Quote>();
  for (const quote of quotes) {
    if (quote) map.set(quote.symbol, quote);
  }
  const fx = await fetchChart("EURUSD=X", true);
  return { map, eurusd: fx?.price ?? null };
}

export const proposeOrder = createServerFn({ method: "POST" })
  .validator((input: OrderPayload) => cleanOrder(input))
  .handler(async ({ data }) => {
    if (!data) return { ok: false as const, error: "The order could not be read." };
    const symbols = [...new Set([data.symbol, ...symbolsFromFills(data.fills)])];
    const { map, eurusd } = await marksFor(symbols);
    const quote = map.get(data.symbol);
    if (!quote) return { ok: false as const, error: "No price is available, so the order was not reviewed." };
    return reviewOrder(data, quote, eurusd, map);
  });

export const confirmOrder = createServerFn({ method: "POST" })
  .validator((input: OrderPayload) => cleanOrder(input))
  .handler(async ({ data }) => {
    if (!data) return { ok: false as const, error: "The order could not be read." };
    if (!data.proposalId || !UUID_RE.test(data.proposalId)) {
      return { ok: false as const, error: "This review is missing its id. Prepare it again." };
    }
    if (typeof data.quotedPrice !== "number" || typeof data.expiresAt !== "number") {
      return { ok: false as const, error: "This review is incomplete. Prepare it again." };
    }
    const symbols = [...new Set([data.symbol, ...symbolsFromFills(data.fills)])];
    const { map, eurusd } = await marksFor(symbols);
    const quote = map.get(data.symbol);
    if (!quote) return { ok: false as const, error: "No price is available, so the order was not recorded." };
    return commitOrder(
      {
        ...data,
        proposalId: data.proposalId,
        quotedPrice: data.quotedPrice,
        expiresAt: data.expiresAt,
      },
      quote,
      eurusd,
      map,
    );
  });

function symbolsFromFills(fills: unknown[]): string[] {
  const out: string[] = [];
  for (const fill of fills) {
    if (!fill || typeof fill !== "object") continue;
    const symbol = (fill as { symbol?: unknown }).symbol;
    if (typeof symbol !== "string") continue;
    const clean = symbol.trim().toUpperCase();
    if (SYMBOL_RE.test(clean) && !out.includes(clean)) out.push(clean);
  }
  return out.slice(0, 20);
}
