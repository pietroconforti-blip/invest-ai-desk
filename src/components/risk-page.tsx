import { PageIntro } from "@/components/ui";
import { Link } from "@tanstack/react-router";
import { useDesk, useMarketQuery } from "@/components/market-context";
import { brokerStatus } from "@/lib/api.functions";
import { formatEur, formatShare } from "@/lib/format";
import { MAX_ORDER_EUR, STARTING_CAPITAL_EUR } from "@/lib/ledger";
import { useQuery } from "@tanstack/react-query";

export function RiskPage() {
  const { book, valuation } = useDesk();
  const market = useMarketQuery();
  const status = useQuery({ queryKey: ["broker-status"], queryFn: () => brokerStatus() });
  const equity = valuation?.equity ?? book?.cash ?? STARTING_CAPITAL_EUR;
  const invested = valuation?.invested ?? 0;
  const exposure = equity > 0 ? invested / equity : 0;
  const ranked = [...(valuation?.positions ?? [])].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const largest = ranked[0];
  const nextOrder = Math.min(MAX_ORDER_EUR, book?.cash ?? 0);

  return (
    <div>
      <PageIntro kicker="The limits" title="Risk">
        The €10 cap and the paper-only rule are checked again on the server when an order is reviewed and when it is recorded. This page is a display, not the control.
      </PageIntro>

      <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
        <Line term="Starting capital" value={formatEur(STARTING_CAPITAL_EUR)} />
        <Line term="Cash now" value={formatEur(book?.cash)} />
        <Line term="Maximum proposed order" value={formatEur(MAX_ORDER_EUR)} />
        <Line term="Next order, given cash" value={formatEur(Math.max(0, nextOrder))} />
        <Line term="Trading mode" value="Paper, local book" />
        <Line term="Broker" value={status.data?.connected ? "Connected" : "Not connected"} />
        <Line term="Live trading" value="Disabled" />
        <Line term="Manual approval" value="Required" />
      </dl>
      <p className="mt-4 text-sm text-muted">{status.data?.message ?? "Checking whether a broker is configured."}</p>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Exposure</h2>
        <p className="mt-2 text-sm text-muted">{formatShare(exposure)} of marked equity is in holdings. The rest is cash.</p>
        <div className="mt-4 h-1 bg-line" aria-hidden="true">
          <div className="h-1 bg-gold" style={{ width: `${Math.min(100, exposure * 100)}%` }} />
        </div>
        <ul className="mt-6 space-y-4">
          {ranked.map((position) => (
            <li key={position.symbol}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{position.symbol}</span>
                <span className="tabular-nums text-muted">{formatShare(position.weight)}</span>
              </div>
              <div className="mt-2 h-px bg-line">
                <div className="h-px bg-ivory" style={{ width: `${Math.min(100, (position.weight ?? 0) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {largest && (largest.weight ?? 0) > 0.35 ? (
          <p className="mt-4 text-sm text-ivory">{largest.symbol} is {formatShare(largest.weight)} of equity. That is a high concentration for one name.</p>
        ) : null}
        {ranked.length === 0 ? <p className="mt-4 text-sm text-muted">No holdings, so concentration is zero.</p> : null}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Illustrative downside</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A scenario, not a prediction. The same percentage is applied to every marked holding and cash is left unchanged. It ignores gaps, currency, and liquidity.
        </p>
        {valuation?.complete ? (
          <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
            <Line term="If holdings fall 10%" value={formatEur(valuation.cash + invested * 0.9)} />
            <Line term="If holdings fall 20%" value={formatEur(valuation.cash + invested * 0.8)} />
            <Line term="Cash, unchanged" value={formatEur(valuation.cash)} />
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted">The scenario waits until every holding has a euro price.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Standing warnings</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          <li className="border-l border-gold pl-3">No order is sent to Alpaca or any other broker. There is no live-trading code path.</li>
          <li className="border-l border-gold pl-3">Market data is delayed and can fail. Missing prices are not replaced with invented ones.</li>
          <li className="border-l border-gold pl-3">AI briefs are interpretation. They are not facts, and they are not instructions to trade.</li>
          <li className="border-l border-gold pl-3">The book is stored in this browser. Another device will not see it.</li>
          {market.data?.warnings.map((warning) => (
            <li key={warning} className="border-l border-line pl-3">{warning}</li>
          ))}
        </ul>
        <Link to="/portfolio" className="mt-6 inline-flex h-11 items-center text-sm text-gold">
          Review a paper order
        </Link>
      </section>
    </div>
  );
}

function Line({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
