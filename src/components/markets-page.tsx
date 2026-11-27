import { useState, type FormEvent } from "react";
import { searchMarket } from "@/lib/api.functions";
import { useMarketQuery } from "@/components/market-context";
import { QuoteRow } from "@/components/quote-row";
import { Button, Change, Notice, PageIntro, fieldClass } from "@/components/ui";
import { formatWhen } from "@/lib/format";
import { INDEX_LABELS } from "@/lib/listings";
import { usePortfolio } from "@/lib/portfolio";
import type { SearchHit } from "@/lib/types";

export function MarketsPage() {
  const query = useMarketQuery();
  const watchlist = usePortfolio((state) => state.watchlist);
  const addWatch = usePortfolio((state) => state.addWatch);
  const removeWatch = usePortfolio((state) => state.removeWatch);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const quotes = new Map((query.data?.quotes ?? []).map((quote) => [quote.symbol, quote]));

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setMessage(null);
    try {
      const result = await searchMarket({ data: { q } });
      setHits(result.hits);
      if (!result.hits.length) setMessage("No stock, ETF, or index matched that search.");
    } catch {
      setMessage("Search did not respond.");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <PageIntro kicker="The tape" title="Markets">
        Prices, session moves, and headlines from the delayed Yahoo chart feed. Nothing here is a broker quote.
      </PageIntro>

      <div className="mt-8 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        {(query.data?.indices ?? []).map((index) => (
          <div key={index.symbol} className="border-t border-gold bg-ink-raised px-4 py-5">
            <p className="text-xs tracking-widest text-faint uppercase">{INDEX_LABELS[index.symbol] ?? index.name}</p>
            <p className="mt-3 font-serif text-3xl tabular-nums">
              {index.price == null ? "—" : index.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-sm"><Change value={index.changePercent} /></p>
          </div>
        ))}
      </div>
      {query.isLoading ? <p className="mt-4 text-sm text-muted">Fetching delayed quotes…</p> : null}
      {query.isError ? (
        <div className="mt-4">
          <Notice tone="bad">The market feed did not respond.</Notice>
          <Button className="mt-3" variant="ghost" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Watchlist</h2>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void onSearch(event)}>
          <input
            className={fieldClass}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search a name or ticker"
            aria-label="Search listings"
          />
          <Button type="submit" variant="ghost" disabled={searching || q.trim().length < 1}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
        {hits.length > 0 ? (
          <ul className="frame mt-4 divide-y divide-line">
            {hits.map((hit) => {
              const listed = watchlist.some((item) => item.symbol === hit.symbol);
              return (
                <li key={hit.symbol} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{hit.symbol}</p>
                    <p className="truncate text-xs text-faint">{hit.name}{hit.exchange ? ` · ${hit.exchange}` : ""}</p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-xs tracking-widest text-gold uppercase disabled:text-faint"
                    disabled={listed}
                    onClick={() => {
                      const problem = addWatch(hit);
                      setMessage(problem ?? (listed ? null : `${hit.symbol} added to the watchlist.`));
                    }}
                  >
                    {listed ? "On the list" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="mt-4">
          {watchlist.length === 0 ? <p className="text-sm text-muted">The watchlist is empty.</p> : null}
          {watchlist.map((item) => {
            const quote = quotes.get(item.symbol);
            if (!quote) return <p key={item.symbol} className="border-b border-line py-4 text-sm text-muted">{item.symbol} · price unavailable</p>;
            return <QuoteRow key={item.symbol} quote={quote} onRemove={() => removeWatch(item.symbol)} />;
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Headlines</h2>
        <ul className="mt-4 divide-y divide-line">
          {(query.data?.news ?? []).map((item) => (
            <li key={item.id} className="py-4">
              <a href={item.link} target="_blank" rel="noreferrer" className="font-medium hover:text-gold">
                {item.title}
              </a>
              <p className="mt-1 text-xs text-faint">
                {item.publisher} · {item.symbol} · {formatWhen(item.time)}
              </p>
            </li>
          ))}
        </ul>
        {query.data && query.data.news.length === 0 ? <p className="mt-3 text-sm text-muted">No headlines came back with this refresh.</p> : null}
        {query.data?.warnings.length ? <p className="mt-3 text-xs text-faint">{query.data.warnings.join(" ")}</p> : null}
      </section>
    </div>
  );
}
