import { Link } from "@tanstack/react-router";
import { Sparkline } from "@/components/charts";
import { Change } from "@/components/ui";
import { formatMoney, toneOf } from "@/lib/format";
import type { Quote } from "@/lib/types";

export function QuoteRow({ quote, onRemove }: { quote: Quote; onRemove?: () => void }) {
  const series = quote.price != null && quote.history.length ? [...quote.history.slice(0, -1), quote.price] : quote.history;
  return (
    <div className="flex items-center gap-3 border-b border-line py-4 last:border-b-0">
      <Link to="/research" search={{ symbol: quote.symbol }} className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-serif text-2xl leading-none">{quote.symbol}</span>
            <span className="block truncate text-xs text-faint">{quote.name}</span>
          </span>
          <span className="text-right">
            <span className="block tabular-nums">{formatMoney(quote.price, quote.currency)}</span>
            <span className="block text-sm">
              <Change value={quote.changePercent} />
            </span>
          </span>
        </span>
      </Link>
      <div className="hidden sm:block">
        <Sparkline values={series} tone={toneOf(quote.changePercent)} />
      </div>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="min-h-11 px-2 text-xs tracking-widest text-faint uppercase hover:text-ivory">
          Remove
        </button>
      ) : null}
    </div>
  );
}
