import { useState } from "react";
import { useDesk } from "@/components/market-context";
import { OrderDesk } from "@/components/order-desk";
import { Notice, PageIntro, SignedEur } from "@/components/ui";
import { formatClock, formatEur, formatQty } from "@/lib/format";
import { STARTING_CAPITAL_EUR } from "@/lib/ledger";
import { usePortfolio } from "@/lib/portfolio";

export function PortfolioPage() {
  const { book, bookError, valuation } = useDesk();
  const resetBook = usePortfolio((state) => state.resetBook);
  const [armed, setArmed] = useState(false);

  return (
    <div>
      <PageIntro kicker="The book" title="Portfolio">
        Holdings in the local paper book, marked with delayed prices. This is not an Alpaca account and it is not a live brokerage balance.
      </PageIntro>
      {bookError ? (
        <div className="mt-4">
          <Notice tone="bad">{bookError}</Notice>
        </div>
      ) : null}

      <dl className="mt-8 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        <Stat term="Equity" value={formatEur(valuation?.equity)} />
        <Stat term="Cash" value={formatEur(book?.cash)} />
        <Stat term="Invested" value={formatEur(valuation?.invested)} />
        <Stat term="Realized" value={formatEur(book?.realized, true)} />
      </dl>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Positions</h2>
        {valuation && valuation.positions.length > 0 ? (
          <ul className="mt-4 divide-y divide-line">
            {valuation.positions.map((position) => (
              <li key={position.symbol} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
                <div className="min-w-0">
                  <p className="font-medium">{position.symbol}</p>
                  <p className="truncate text-xs text-faint">
                    {position.name} · {formatQty(position.qty)} · cost {formatEur(position.costEur)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="tabular-nums">{formatEur(position.marketEur ?? position.costEur)}</p>
                  <p className="text-sm"><SignedEur value={position.unrealizedEur} /></p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No open positions. Starting capital remains {formatEur(STARTING_CAPITAL_EUR)} until a paper buy is approved.</p>
        )}
        {valuation && !valuation.complete ? (
          <p className="mt-3 text-xs text-faint">Missing prices: {valuation.missing.join(", ")}. Those lines use cost.</p>
        ) : null}
      </section>

      <div className="mt-10">
        <OrderDesk />
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Recorded orders</h2>
        <ul className="mt-4 divide-y divide-line">
          {(book?.events ?? []).slice().reverse().map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
              <div>
                <p>
                  {event.side === "buy" ? "Buy" : "Sell"} {event.symbol}
                  <span className="text-faint"> · {formatQty(event.qty)}</span>
                </p>
                <p className="text-xs text-faint">{formatClock(event.time)} · local paper · not sent</p>
              </div>
              <div className="text-right tabular-nums">
                <p>{formatEur(event.notionalEur)}</p>
                {event.side === "sell" ? <p className="text-xs"><SignedEur value={event.realizedEur} /></p> : null}
              </div>
            </li>
          ))}
        </ul>
        {book && book.events.length === 0 ? <p className="mt-3 text-sm text-muted">No paper orders recorded.</p> : null}
      </section>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="font-serif text-3xl">Reset</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Clears fills and the equity line on this device and returns the book to {formatEur(STARTING_CAPITAL_EUR)}. Watchlist and stored briefs stay.
        </p>
        {armed ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="h-11 border border-loss px-4 text-sm text-loss" onClick={() => { resetBook(); setArmed(false); }}>
              Confirm reset
            </button>
            <button type="button" className="h-11 px-4 text-sm text-muted" onClick={() => setArmed(false)}>
              Keep the book
            </button>
          </div>
        ) : (
          <button type="button" className="mt-4 h-11 border border-line px-4 text-sm text-ivory hover:border-gold" onClick={() => setArmed(true)}>
            Reset paper book
          </button>
        )}
      </section>
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="border-t border-gold bg-ink-raised px-4 py-5">
      <dt className="text-xs tracking-widest text-faint uppercase">{term}</dt>
      <dd className="mt-3 font-serif text-3xl tabular-nums">{value}</dd>
    </div>
  );
}
