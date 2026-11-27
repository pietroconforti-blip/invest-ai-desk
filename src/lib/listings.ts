export const DEFAULT_WATCHLIST = [
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "ASML", name: "ASML" },
  { symbol: "VWCE.DE", name: "Vanguard FTSE All-World" },
] as const;

export const INDEX_SYMBOLS = ["^GSPC", "^IXIC", "^GDAXI", "^STOXX50E"] as const;

export const INDEX_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^IXIC": "Nasdaq",
  "^GDAXI": "DAX",
  "^STOXX50E": "Euro Stoxx 50",
};

export const LISTING_NOTES: Record<string, string> = {
  NVDA: "Nasdaq listing, priced in US dollars.",
  MSFT: "Nasdaq listing, priced in US dollars.",
  ASML: "Nasdaq listing, priced in US dollars. The Amsterdam line is a different ticker.",
  "VWCE.DE": "Xetra listing of the Vanguard FTSE All-World UCITS ETF, priced in euros.",
};

export function listingNote(symbol: string): string | null {
  return LISTING_NOTES[symbol] ?? null;
}
