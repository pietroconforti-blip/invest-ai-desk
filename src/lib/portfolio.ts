import { create } from "zustand";
import { persist } from "zustand/middleware";
import { assertBook, type StoredFill } from "@/lib/ledger";
import { DEFAULT_WATCHLIST } from "@/lib/listings";
import type { ResearchReport } from "@/lib/types";

export type WatchItem = { symbol: string; name: string };
export type EquityMark = { t: number; equity: number };

type PortfolioState = {
  hydrated: boolean;
  fills: StoredFill[];
  watchlist: WatchItem[];
  snapshots: EquityMark[];
  reports: Record<string, ResearchReport>;
  applyFill: (fill: StoredFill) => void;
  resetBook: () => void;
  addWatch: (item: WatchItem) => string | null;
  removeWatch: (symbol: string) => void;
  saveReport: (report: ResearchReport) => void;
  recordEquity: (equity: number) => void;
};

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      fills: [],
      watchlist: DEFAULT_WATCHLIST.map((item) => ({ symbol: item.symbol, name: item.name })),
      snapshots: [],
      reports: {},
      applyFill: (fill) => {
        const fills = get().fills;
        if (fills.some((row) => row.id === fill.id)) return;
        assertBook([...fills, fill]);
        set({ fills: [...fills, fill] });
      },
      resetBook: () => set({ fills: [], snapshots: [] }),
      addWatch: (item) => {
        const symbol = item.symbol.toUpperCase();
        const watchlist = get().watchlist;
        if (watchlist.some((row) => row.symbol === symbol)) return null;
        if (watchlist.length >= 16) return "The list holds 16 names.";
        set({ watchlist: [...watchlist, { symbol, name: item.name.slice(0, 80) || symbol }] });
        return null;
      },
      removeWatch: (symbol) => set({ watchlist: get().watchlist.filter((row) => row.symbol !== symbol) }),
      saveReport: (report) => {
        const key = report.symbols.join("|");
        const reports = { ...get().reports, [key]: report };
        const keys = Object.keys(reports);
        while (Object.keys(reports).length > 12) {
          const oldest = keys.shift();
          if (!oldest || oldest === key) break;
          delete reports[oldest];
        }
        set({ reports });
      },
      recordEquity: (equity) => {
        if (!Number.isFinite(equity) || equity < 0) return;
        const rounded = Math.round(equity * 100) / 100;
        const snapshots = get().snapshots;
        const last = snapshots[snapshots.length - 1];
        const t = Date.now();
        if (last && t - last.t < 5 * 60 * 1000) {
          if (Math.abs(last.equity - rounded) < 0.005) return;
          const next = snapshots.slice();
          next[next.length - 1] = { t, equity: rounded };
          set({ snapshots: next });
          return;
        }
        set({ snapshots: [...snapshots, { t, equity: rounded }].slice(-180) });
      },
    }),
    {
      name: "invest-ai-book-v1",
      skipHydration: true,
      partialize: (state) => ({
        fills: state.fills,
        watchlist: state.watchlist,
        snapshots: state.snapshots,
        reports: state.reports,
      }),
    },
  ),
);

export function reportKey(symbols: string[]): string {
  return symbols.join("|");
}
