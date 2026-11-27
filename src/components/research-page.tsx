import { useEffect, useState, type ReactNode } from "react";
import { researchBrief } from "@/lib/api.functions";
import { useDesk, useMarketQuery } from "@/components/market-context";
import { Button, Change, Kicker, Notice, PageIntro } from "@/components/ui";
import { formatClock, formatCompact, formatMoney, formatPct } from "@/lib/format";
import { listingNote } from "@/lib/listings";
import { reportKey, usePortfolio } from "@/lib/portfolio";
import type { Quote, ResearchReport } from "@/lib/types";

export function ResearchPage({ initialSymbol }: { initialSymbol?: string }) {
  const query = useMarketQuery();
  const { quotes } = useDesk();
  const watchlist = usePortfolio((state) => state.watchlist);
  const reports = usePortfolio((state) => state.reports);
  const saveReport = usePortfolio((state) => state.saveReport);
  const [primary, setPrimary] = useState(initialSymbol || watchlist[0]?.symbol || "NVDA");
  const [compare, setCompare] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSymbol) setPrimary(initialSymbol);
  }, [initialSymbol]);

  const symbols = [primary, compare].filter(Boolean);
  const cached = reports[reportKey(symbols)] ?? null;
  const [fresh, setFresh] = useState<ResearchReport | null>(null);
  const report = fresh && reportKey(fresh.symbols) === reportKey(symbols) ? fresh : cached;

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const result = await researchBrief({ data: { symbols } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      saveReport(result.report);
      setFresh(result.report);
    } catch {
      setError("The brief could not be requested.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageIntro kicker="The atelier" title="Research">
        The figures below come from the market feed. A brief, if you ask for one, is labeled as interpretation and is not a recommendation.
      </PageIntro>

      <div className="mt-6 flex flex-wrap gap-2">
        {watchlist.map((item) => (
          <button
            key={item.symbol}
            type="button"
            onClick={() => { setPrimary(item.symbol); setFresh(null); }}
            className={`min-h-11 border px-4 text-xs tracking-widest uppercase ${primary === item.symbol ? "border-gold bg-gold text-ink" : "border-line text-muted hover:border-gold"}`}
          >
            {item.symbol}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm text-muted">
        Compare with
        <select
          className="mt-2 h-11 w-full max-w-xs border border-line bg-ink px-3 font-serif text-xl text-ivory"
          value={compare}
          onChange={(event) => { setCompare(event.target.value); setFresh(null); }}
        >
          <option value="">No comparison</option>
          {watchlist.filter((item) => item.symbol !== primary).map((item) => (
            <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
          ))}
        </select>
      </label>

      <div className="mt-8 grid gap-px bg-line lg:grid-cols-2">
        {symbols.map((symbol) => (
          <Snapshot key={symbol} quote={quotes.get(symbol)} symbol={symbol} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void generate()} disabled={pending || symbols.length < 1 || query.isLoading}>
          {pending ? "Writing the brief…" : "Generate research brief"}
        </Button>
        <p className="text-xs text-faint">One request at a time. The model only sees this snapshot.</p>
      </div>
      {error ? <div className="mt-4"><Notice tone="bad">{error}</Notice></div> : null}

      {report ? <Brief report={report} /> : (
        <p className="mt-8 text-sm text-muted">No brief is stored for this selection. The snapshot above is still the feed, not a model.</p>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Related headlines</h2>
        <ul className="mt-4 divide-y divide-line">
          {(query.data?.news ?? []).filter((item) => symbols.includes(item.symbol)).map((item) => (
            <li key={item.id} className="py-3">
              <a href={item.link} target="_blank" rel="noreferrer" className="hover:text-gold">{item.title}</a>
              <p className="mt-1 text-xs text-faint">{item.publisher} · {item.symbol}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Snapshot({ quote, symbol }: { quote: Quote | undefined; symbol: string }) {
  return (
    <article className="bg-ink-raised p-6">
      <Kicker>From the feed</Kicker>
      <h2 className="mt-3 font-serif text-4xl">{symbol}</h2>
      <p className="text-sm text-muted">{quote?.name ?? "Price unavailable"}</p>
      {listingNote(symbol) ? <p className="mt-2 text-xs text-faint">{listingNote(symbol)}</p> : null}
      {quote ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact term="Price" value={formatMoney(quote.price, quote.currency)} />
          <Fact term="Session" value={<Change value={quote.changePercent} />} />
          <Fact term="History" value={formatPct(quote.historyReturn)} />
          <Fact term="Volume" value={formatCompact(quote.volume)} />
          <Fact term="Day range" value={`${formatMoney(quote.dayLow, quote.currency)} – ${formatMoney(quote.dayHigh, quote.currency)}`} />
          <Fact term="52-week" value={`${formatMoney(quote.yearLow, quote.currency)} – ${formatMoney(quote.yearHigh, quote.currency)}`} />
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted">This listing has no quote in the latest refresh.</p>
      )}
      <p className="mt-3 text-xs text-faint">History is the change across the daily closes returned, up to about three months. It is not a total return.</p>
    </article>
  );
}

function Fact({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-widest text-faint uppercase">{term}</dt>
      <dd className="mt-1 tabular-nums">{value}</dd>
    </div>
  );
}

function Brief({ report }: { report: ResearchReport }) {
  return (
    <article className="frame mt-8">
      <header className="border-b border-line px-6 py-6">
        <Kicker>Interpretation · {report.model}</Kicker>
        <h2 className="mt-3 font-serif text-4xl leading-tight">{report.headline}</h2>
        <p className="mt-2 text-xs text-faint">Generated {formatClock(report.generatedAt)}. Not a recommendation. Not an order.</p>
      </header>
      <div className="grid gap-8 px-6 py-6">
        <Section title="Cited from the snapshot" items={report.facts} />
        <div>
          <h3 className="text-xs tracking-widest text-gold uppercase">Reading</h3>
          <p className="mt-2 text-sm text-muted">{report.interpretation}</p>
        </div>
        <Section title="Risks" items={report.risks} />
        <div className="grid gap-px bg-line md:grid-cols-2">
          <div className="bg-ink p-4">
            <Section title="If the bull case" items={report.bullCase} />
          </div>
          <div className="bg-ink p-4">
            <Section title="If the bear case" items={report.bearCase} />
          </div>
        </div>
        <div>
          <h3 className="text-xs tracking-widest text-gold uppercase">Headlines</h3>
          <p className="mt-2 text-sm text-muted">{report.newsRead}</p>
        </div>
        <Section title="Assumptions" items={report.assumptions} />
      </div>
    </article>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-xs tracking-widest text-gold uppercase">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {items.map((item) => (
            <li key={item} className="border-l border-line pl-3">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-faint">None returned.</p>
      )}
    </section>
  );
}
