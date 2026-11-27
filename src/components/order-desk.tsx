import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { confirmOrder, proposeOrder } from "@/lib/api.functions";
import { useDesk, useMarketQuery } from "@/components/market-context";
import { Button, Field, Notice, fieldClass } from "@/components/ui";
import { formatEur, formatMoney, formatQty } from "@/lib/format";
import { MAX_ORDER_EUR, MIN_ORDER_EUR, type Side } from "@/lib/ledger";
import { listingNote } from "@/lib/listings";
import { usePortfolio } from "@/lib/portfolio";
import type { OrderProposal } from "@/lib/types";
import { eurPerUnit } from "@/lib/value";

export function OrderDesk() {
  const { quotes, book, bookError, valuation } = useDesk();
  const fills = usePortfolio((state) => state.fills);
  const watchlist = usePortfolio((state) => state.watchlist);
  const applyFill = usePortfolio((state) => state.applyFill);
  const eurusd = useMarketQuery().data?.eurusd ?? null;
  const [side, setSide] = useState<Side>("buy");
  const [symbol, setSymbol] = useState(watchlist[0]?.symbol ?? "VWCE.DE");
  const [amount, setAmount] = useState(MIN_ORDER_EUR);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposal, setProposal] = useState<OrderProposal | null>(null);
  const [approved, setApproved] = useState(false);

  const choices = useMemo(() => {
    const map = new Map<string, string>();
    if (side === "buy") {
      for (const item of watchlist) map.set(item.symbol, item.name);
    }
    for (const position of book?.positions ?? []) map.set(position.symbol, position.name);
    return [...map.entries()].map(([value, name]) => ({ value, name }));
  }, [side, watchlist, book]);

  useEffect(() => {
    if (!choices.some((choice) => choice.value === symbol)) {
      setSymbol(choices[0]?.value ?? "");
    }
  }, [choices, symbol]);

  const quote = quotes.get(symbol);
  const position = valuation?.positions.find((row) => row.symbol === symbol);
  const positionValue = position?.marketEur ?? 0;
  const cash = book?.cash ?? 0;
  const cap = side === "buy" ? Math.min(MAX_ORDER_EUR, cash) : Math.min(MAX_ORDER_EUR, positionValue);
  const dustClose = side === "sell" && positionValue > 0 && positionValue < MIN_ORDER_EUR && positionValue <= MAX_ORDER_EUR;

  useEffect(() => {
    setAmount((current) => {
      if (dustClose) return Math.round(positionValue * 100) / 100;
      const next = Math.min(Math.max(current, MIN_ORDER_EUR), Math.max(MIN_ORDER_EUR, cap));
      return Math.abs(next - current) < 0.001 ? current : next;
    });
  }, [cap, dustClose, positionValue]);

  const fx = quote ? eurPerUnit(quote.currency, eurusd) : null;
  const estimateQty = quote?.price && fx && amount > 0 ? amount / (quote.price * fx) : null;
  const blocked = !book || bookError != null || !symbol || cap + 0.001 < (dustClose ? positionValue : MIN_ORDER_EUR) || !quote?.price || fx == null;

  async function review() {
    setError(null);
    setNotice(null);
    setApproved(false);
    setPending(true);
    try {
      const result = await proposeOrder({ data: { symbol, side, notionalEur: amount, fills } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProposal(result.proposal);
    } catch {
      setError("The review could not be completed. The order was not recorded.");
    } finally {
      setPending(false);
    }
  }

  async function commit() {
    if (!proposal || !approved) return;
    setPending(true);
    setError(null);
    try {
      const result = await confirmOrder({
        data: {
          symbol: proposal.symbol,
          side: proposal.side,
          notionalEur: proposal.notionalEur,
          fills,
          proposalId: proposal.id,
          quotedPrice: proposal.priceNative,
          expiresAt: proposal.expiresAt,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyFill(result.fill);
      setProposal(null);
      setApproved(false);
      setNotice("Recorded in the local paper book. Nothing was sent to a broker.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The order was not recorded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="frame p-6 md:p-8">
      <h2 className="font-serif text-3xl">Paper ticket</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Review builds a priced ticket on the server. Nothing is recorded until you approve it in the next step. Live trading stays off.
      </p>
      {bookError ? <div className="mt-4"><Notice tone="bad">{bookError}</Notice></div> : null}
      {notice ? <div className="mt-4"><Notice>{notice}</Notice></div> : null}
      {error && !proposal ? <div className="mt-4"><Notice tone="bad">{error}</Notice></div> : null}

      <div className="mt-6 grid grid-cols-2 gap-px bg-line">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            className={`h-11 text-sm capitalize ${side === value ? "border-t-2 border-gold bg-panel text-ivory" : "bg-ink text-muted"}`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5">
        <Field label="Listing" htmlFor="ticket-symbol">
          <select id="ticket-symbol" className={fieldClass} value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            {choices.length === 0 ? <option value="">No listing</option> : null}
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.value} · {choice.name}
              </option>
            ))}
          </select>
        </Field>
        {listingNote(symbol) ? <p className="text-xs text-faint">{listingNote(symbol)}</p> : null}
        <Field label="Amount in euros" htmlFor="ticket-amount">
          <input
            id="ticket-amount"
            className={fieldClass}
            type="number"
            min={dustClose ? 0 : MIN_ORDER_EUR}
            max={MAX_ORDER_EUR}
            step="0.01"
            value={amount}
            disabled={dustClose}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </Field>
        {!dustClose && cap >= MIN_ORDER_EUR ? (
          <input
            aria-label="Amount slider"
            type="range"
            min={MIN_ORDER_EUR}
            max={Math.min(MAX_ORDER_EUR, cap)}
            step="0.5"
            value={Math.min(amount, cap)}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        ) : null}
        <p className="text-sm text-muted">
          {dustClose
            ? `The holding is under €${MIN_ORDER_EUR}, so the only sale is to close it.`
            : side === "buy"
              ? `Cash ${formatEur(cash)}. The cap is ${formatEur(Math.min(MAX_ORDER_EUR, cash))}.`
              : `Sellable at the delayed price: ${formatEur(positionValue)}.`}
          {estimateQty != null && quote ? ` About ${formatQty(estimateQty)} shares at ${formatMoney(quote.price, quote.currency)}.` : ""}
        </p>
        <Button onClick={() => void review()} disabled={pending || blocked}>
          {pending && !proposal ? "Reviewing…" : "Review order"}
        </Button>
        {blocked && !bookError ? (
          <p className="text-xs text-faint">
            {!quote?.price
              ? "A delayed price is required before review."
              : fx == null
                ? "The euro rate is missing, so this listing cannot be sized."
                : side === "sell" && positionValue <= 0
                  ? "There is no marked position to sell."
                  : cash < MIN_ORDER_EUR && side === "buy"
                    ? "Paper cash is below the minimum order."
                    : null}
          </p>
        ) : null}
      </div>

      <Dialog.Root open={proposal != null} onOpenChange={(open) => { if (!open) { setProposal(null); setApproved(false); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/80" />
          <Dialog.Content className="frame fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[min(100%-2rem,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6">
            {proposal ? (
              <>
                <p className="text-xs tracking-widest text-gold uppercase">Manual approval</p>
                <Dialog.Title className="mt-2 font-serif text-4xl">Review paper order</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted">
                  Check the terms. Approving records the fill on this device only.
                </Dialog.Description>
                <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
                  <Row term="Symbol" value={`${proposal.symbol} · ${proposal.name}`} />
                  <Row term="Side" value={proposal.side === "buy" ? "Buy" : "Sell"} />
                  <Row term="Quantity" value={formatQty(proposal.qty)} />
                  <Row term="Reference price" value={formatMoney(proposal.priceNative, proposal.currency)} />
                  <Row term="Estimated value" value={formatEur(proposal.notionalEur)} />
                  <Row term="Cash after" value={formatEur(proposal.cashAfter)} />
                  <Row term="Position after" value={`${formatQty(proposal.positionQtyAfter)} shares`} />
                  <Row term="Mode" value="Local paper" />
                  <Row term="Live trading" value="Disabled" />
                  <Row term="Sent to broker" value="No" />
                </dl>
                <ul className="mt-5 space-y-2 text-sm text-muted">
                  {proposal.risks.map((risk) => (
                    <li key={risk} className="border-l border-gold pl-3">{risk}</li>
                  ))}
                </ul>
                {error ? <div className="mt-4"><Notice tone="bad">{error}</Notice></div> : null}
                <label className="mt-5 flex min-h-11 items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-gold"
                    checked={approved}
                    onChange={(event) => setApproved(event.target.checked)}
                  />
                  <span>I explicitly approve this paper order. It updates only the local book and is not sent to a broker.</span>
                </label>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => void commit()} disabled={!approved || pending}>
                    {pending ? "Recording…" : "Record approved paper order"}
                  </Button>
                  <Dialog.Close className="inline-flex h-11 items-center justify-center border border-line px-4 text-sm text-ivory hover:border-gold">
                    Cancel
                  </Dialog.Close>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-faint">{term}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

