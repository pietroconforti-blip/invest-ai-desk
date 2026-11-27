import { INDEX_SYMBOLS } from "@/lib/listings";
import type { MarketPayload, NewsItem, Quote, QuoteKind, SearchHit } from "@/lib/types";

const UA = "Mozilla/5.0 (compatible; InvestAI/1.0; +https://invest.ai)";
const QUOTE_TTL = 45_000;
const MISS_TTL = 12_000;

const quoteCache = new Map<string, { at: number; quote: Quote }>();
const missCache = new Map<string, number>();

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function kindOf(symbol: string, instrument: string | null, name: string): QuoteKind {
  if (symbol.includes("=X") || instrument === "CURRENCY") return "fx";
  if (symbol.startsWith("^") || instrument === "INDEX") return "index";
  if (instrument === "ETF" || /ETF|UCITS/i.test(name)) return "etf";
  if (instrument === "EQUITY" || instrument == null) return "equity";
  return "other";
}

function cleanHistory(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const closes: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) closes.push(value);
  }
  return closes.slice(-63);
}

export async function fetchChart(symbol: string, force = false): Promise<Quote | null> {
  const key = symbol.toUpperCase();
  if (!force) {
    const cached = quoteCache.get(key);
    if (cached && Date.now() - cached.at < QUOTE_TTL) return cached.quote;
    const missed = missCache.get(key);
    if (missed && Date.now() - missed < MISS_TTL) return null;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(key)}?interval=1d&range=3mo`;
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      missCache.set(key, Date.now());
      return null;
    }
    const body = (await response.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Array<{ close?: unknown }> } }> };
    };
    const result = body.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) {
      missCache.set(key, Date.now());
      return null;
    }
    const price = num(meta.regularMarketPrice);
    const changePercent = num(meta.regularMarketChangePercent);
    const history = cleanHistory(result?.indicators?.quote?.[0]?.close);
    const historyReturn =
      history.length >= 2 && history[0] > 0 ? ((history[history.length - 1] - history[0]) / history[0]) * 100 : null;
    const previousClose =
      price != null && changePercent != null ? price / (1 + changePercent / 100) : (history.length >= 2 ? history[history.length - 2] : null);
    const name = String(meta.longName || meta.shortName || key);
    const instrument = typeof meta.instrumentType === "string" ? meta.instrumentType : null;
    const quote: Quote = {
      symbol: key,
      name: name.slice(0, 80),
      currency: typeof meta.currency === "string" ? meta.currency : null,
      price,
      changePercent,
      previousClose,
      dayHigh: num(meta.regularMarketDayHigh),
      dayLow: num(meta.regularMarketDayLow),
      yearHigh: num(meta.fiftyTwoWeekHigh),
      yearLow: num(meta.fiftyTwoWeekLow),
      volume: num(meta.regularMarketVolume),
      exchange: typeof meta.fullExchangeName === "string" ? meta.fullExchangeName : null,
      time: num(meta.regularMarketTime),
      history,
      historyReturn,
      kind: kindOf(key, instrument, name),
    };
    if (quote.price == null) {
      missCache.set(key, Date.now());
      return null;
    }
    quoteCache.set(key, { at: Date.now(), quote });
    return quote;
  } catch {
    missCache.set(key, Date.now());
    return null;
  }
}

async function fetchNews(symbol: string): Promise<NewsItem[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=4`;
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { news?: Array<Record<string, unknown>> };
    const items: NewsItem[] = [];
    for (const row of body.news ?? []) {
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const link = typeof row.link === "string" ? row.link : "";
      if (!title || !link.startsWith("https://")) continue;
      items.push({
        id: typeof row.uuid === "string" ? row.uuid : link,
        title: title.slice(0, 180),
        publisher: typeof row.publisher === "string" ? row.publisher.slice(0, 60) : "News",
        link,
        time: num(row.providerPublishTime),
        symbol,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function loadMarketData(symbols: string[]): Promise<MarketPayload> {
  const wanted = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].slice(0, 20);
  const warnings: string[] = [];
  const [fx, indexQuotes, quotes] = await Promise.all([
    fetchChart("EURUSD=X"),
    Promise.all(INDEX_SYMBOLS.map((symbol) => fetchChart(symbol))),
    Promise.all(wanted.map((symbol) => fetchChart(symbol))),
  ]);

  const indices = indexQuotes.filter((quote): quote is Quote => quote != null);
  const priced = quotes.filter((quote): quote is Quote => quote != null);
  const missing = wanted.filter((symbol) => !priced.some((quote) => quote.symbol === symbol));
  if (missing.length) warnings.push(`No price for ${missing.join(", ")}.`);
  if (!fx?.price) warnings.push("The euro-dollar rate did not load. Dollar listings cannot be valued in euros until it does.");
  if (!priced.length && wanted.length) warnings.push("The market feed did not return quotes.");

  const newsSymbols = wanted.filter((symbol) => !symbol.startsWith("^")).slice(0, 4);
  const newsGroups = await Promise.all(newsSymbols.map((symbol) => fetchNews(symbol)));
  const seen = new Set<string>();
  const news: NewsItem[] = [];
  for (const group of newsGroups) {
    for (const item of group) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      news.push(item);
    }
  }
  if (newsSymbols.length && news.length === 0) warnings.push("Headlines did not load.");

  return {
    quotes: priced,
    indices,
    eurusd: fx?.price ?? null,
    fxTime: fx?.time ?? null,
    news,
    fetchedAt: Date.now(),
    warnings,
  };
}

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 40);
  if (q.length < 1) return [];
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { quotes?: Array<Record<string, unknown>> };
  const hits: SearchHit[] = [];
  for (const row of body.quotes ?? []) {
    const type = typeof row.quoteType === "string" ? row.quoteType : "";
    if (type !== "EQUITY" && type !== "ETF" && type !== "INDEX") continue;
    const symbol = typeof row.symbol === "string" ? row.symbol.toUpperCase() : "";
    if (!/^[A-Z^][A-Z0-9.\-=]{0,15}$/.test(symbol)) continue;
    hits.push({
      symbol,
      name: String(row.shortname || row.longname || symbol).slice(0, 80),
      exchange: typeof row.exchDisp === "string" ? row.exchDisp : "",
      kind: type.toLowerCase(),
    });
  }
  return hits;
}
