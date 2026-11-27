export type QuoteKind = "equity" | "etf" | "index" | "fx" | "other";

export type Quote = {
  symbol: string;
  name: string;
  currency: string | null;
  price: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  exchange: string | null;
  time: number | null;
  history: number[];
  historyReturn: number | null;
  kind: QuoteKind;
};

export type NewsItem = {
  id: string;
  title: string;
  publisher: string;
  link: string;
  time: number | null;
  symbol: string;
};

export type MarketPayload = {
  quotes: Quote[];
  indices: Quote[];
  eurusd: number | null;
  fxTime: number | null;
  news: NewsItem[];
  fetchedAt: number;
  warnings: string[];
};

export type SearchHit = {
  symbol: string;
  name: string;
  exchange: string;
  kind: string;
};

export type ResearchReport = {
  symbols: string[];
  headline: string;
  facts: string[];
  interpretation: string;
  risks: string[];
  bullCase: string[];
  bearCase: string[];
  newsRead: string;
  assumptions: string[];
  generatedAt: string;
  model: string;
};

export type OrderProposal = {
  id: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  qty: number;
  priceNative: number;
  currency: string;
  fxEurPerUnit: number;
  notionalEur: number;
  cashAfter: number;
  positionQtyAfter: number;
  equityAfterEstimate: number | null;
  risks: string[];
  expiresAt: number;
  mode: "local-paper";
  liveTrading: false;
  brokerSubmitted: false;
};
