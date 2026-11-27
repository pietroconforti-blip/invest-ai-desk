import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Allocation, EquityChart } from "@/components/charts";
import { useDesk, useMarketQuery } from "@/components/market-context";
import { QuoteRow } from "@/components/quote-row";
import { Button, Change, Kicker, Notice, PageIntro, SignedEur } from "@/components/ui";
import { formatClock, formatEur, formatPct, toneOf } from "@/lib/format";
import { STARTING_CAPITAL_EUR } from "@/lib/ledger";
import { INDEX_LABELS } from "@/lib/listings";
import { usePortfolio } from "@/lib/portfolio";

export function OverviewPage() {
  const query = useMarketQuery();
  const { quotes, book, bookError, valuation } = useDesk();
  const watchlist = usePortfolio((state) => state.watchlist);
  const snapshots = usePortfolio((state) => state.snapshots);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  const equity = valuation?.equity ?? book?.cash ?? STARTING_CAPITAL_EUR;
  const total = equity - STARTING_CAPITAL_EUR;
  const day = sessionMove(snapshots, equity);
  const asOf = latestTime(query.data?.quotes ?? []);

  return (
    <div>
      <PageIntro kicker={today || "Paper book"} title="The private book">
        Local book. Broker not connected. Live trading is off.
        {asOf ? ` Prices as of ${formatClock(asOf * 1000)}, and they can be delayed.` : " Waiting for a timestamp from the feed."}
      </PageIntro>

      <section className="frame mt-8 px-6 py-8 md:px-10 md:py-10">
        <Kicker>Paper equity</Kicker>
        <p className="mt-4 font-serif text-6xl leading-none tracking-tight tabular-nums md:text-7xl">{valuation ? formatEur(equity) : "—"}</p>
        <p className={`mt-4 text-sm tabular-nums ${toneOf(total) === "gain" ? "text-gain" : toneOf(total) === "loss" ? "text-loss" : "text-muted"}`}>
          {formatEur(total, true)} · {formatPct(STARTING_CAPITAL_EUR ? (total / STARTING_CAPITAL_EUR) * 100 : 0)} from {formatEur(STARTING_CAPITAL_EUR)}
        </p>
      </section>

      <div className="mt-8">
        {query.isLoading ? <p className="text-sm text-muted">Fetching delayed quotes…</p> : null}
        {query.isError ? (
          <Notice tone="bad">
            The market feed did not respond. Marked values are not shown.{" "}
            <button type="button" className="underline" onClick={() => void query.refetch()}>
              Try again
            </button>
          </Notice>
        ) : null}
        {bookError ? <div className="mt-3"><Notice tone="bad">{bookError} Reset the book on the portfolio page.</Notice></div> : null}
        {valuation && !valuation.complete ? (
          <div className="mt-3">
            <Notice>Valuation is incomplete for {valuation.missing.join(", ")}. Those holdings are carried at cost until a price arrives.</Notice>
          </div>
        ) : null}
      </div>

      <section className="mt-8">
        <EquityChart points={snapshots} />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        <Metric label="Cash" value={formatEur(book?.cash)} hint="Available to size a paper buy" />
        <Metric label="Day" value={formatEur(day, true)} hint="Against the previous mark, or the first mark today" tone={toneOf(day)} />
        <Metric label="Unrealized" value={formatEur(valuation?.unrealized, true)} hint="Market value minus euro cost" tone={toneOf(valuation?.unrealized)} />
        <Metric label="Realized" value={formatEur(book?.realized, true)} hint="Locked in when a paper sale is recorded" tone={toneOf(book?.realized)} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_0.8fr]">
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-3xl">Open positions</h2>
            <Link to="/portfolio" className="text-xs tracking-widest text-gold uppercase">
              Full book
            </Link>
          </div>
          {valuation && valuation.positions.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {valuation.positions.map((position) => (
                <li key={position.symbol} className="flex items-baseline justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{position.symbol}</p>
                    <p className="truncate text-xs text-faint">{position.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{formatEur(position.marketEur ?? position.costEur)}</p>
                    <p className="text-sm">
                      <SignedEur value={position.unrealizedEur} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 max-w-md text-sm text-muted">
              No holdings. Cash is {formatEur(book?.cash ?? STARTING_CAPITAL_EUR)}. A paper order is capped at €10 and stays on this device.
            </p>
          )}
        </section>
        <section>
          <h2 className="font-serif text-3xl">Allocation</h2>
          <div className="mt-4">
            {valuation ? (
              <Allocation
                slices={[
                  { name: "Cash", value: valuation.cash },
                  ...valuation.positions
                    .filter((position) => (position.marketEur ?? position.costEur) > 0)
                    .map((position) => ({ name: position.symbol, value: position.marketEur ?? position.costEur })),
                ]}
              />
            ) : (
              <p className="text-sm text-muted">Allocation appears when the book can be read.</p>
            )}
          </div>
          {!valuation?.complete ? <p className="mt-3 text-xs text-faint">Weights use cost where a live euro value is missing.</p> : null}
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-3xl">Watchlist</h2>
          <Link to="/markets" className="text-xs tracking-widest text-gold uppercase">
            Markets
          </Link>
        </div>
        <div className="mt-2">
          {watchlist.map((item) => {
            const quote = quotes.get(item.symbol);
            return quote ? <QuoteRow key={item.symbol} quote={{ ...quote, name: quote.name || item.name }} /> : (
              <p key={item.symbol} className="border-b border-line py-4 text-sm text-muted">{item.symbol} · price unavailable</p>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Market strip</h2>
        <div className="mt-4 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          {(query.data?.indices ?? []).map((index) => (
            <div key={index.symbol} className="border-t border-gold bg-ink-raised px-4 py-5">
              <p className="text-xs tracking-widest text-faint uppercase">{INDEX_LABELS[index.symbol] ?? index.name}</p>
              <p className="mt-2 font-serif text-3xl tabular-nums">{index.price == null ? "—" : index.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-sm"><Change value={index.changePercent} /></p>
            </div>
          ))}
        </div>
        {query.data?.eurusd ? (
          <p className="mt-3 text-xs text-faint">Delayed EURUSD {query.data.eurusd.toFixed(4)}. One euro buys about ${query.data.eurusd.toFixed(4)}.</p>
        ) : null}
        {query.data?.warnings.length ? <p className="mt-2 text-xs text-faint">{query.data.warnings.join(" ")}</p> : null}
        <div className="mt-4">
          <Button variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? "Refreshing…" : "Refresh quotes"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, hint, tone = "flat" }: { label: string; value: string; hint: string; tone?: "gain" | "loss" | "flat" }) {
  return (
    <div className="border-t border-gold bg-ink-raised px-4 py-5">
      <p className="text-xs tracking-widest text-faint uppercase">{label}</p>
      <p className={`mt-3 font-serif text-3xl tabular-nums ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ivory"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function sessionMove(snapshots: { t: number; equity: number }[], equity: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const prior = [...snapshots].reverse().find((point) => point.t < start.getTime());
  if (prior) return equity - prior.equity;
  const first = snapshots.find((point) => point.t >= start.getTime());
  if (!first) return 0;
  return equity - first.equity;
}

function latestTime(quotes: { time: number | null }[]) {
  return quotes.reduce<number | null>((latest, quote) => {
    if (quote.time == null) return latest;
    return latest == null || quote.time > latest ? quote.time : latest;
  }, null);
}
