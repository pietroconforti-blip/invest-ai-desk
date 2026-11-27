export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round6(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function group(n: number, digits: number): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  }).format(Math.abs(n));
}

export function formatEur(n: number | null | undefined, signed = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = group(n, 2);
  if (!signed) return n < 0 ? `−€${abs}` : `€${abs}`;
  if (n > 0) return `+€${abs}`;
  if (n < 0) return `−€${abs}`;
  return `€${abs}`;
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

export function formatShare(part: number | null | undefined): string {
  if (part == null || !Number.isFinite(part)) return "—";
  return `${(part * 100).toFixed(1)}%`;
}

export function formatMoney(n: number | null | undefined, currency: string | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const digits = Math.abs(n) >= 1 ? 2 : 4;
  const abs = group(n, digits);
  if (currency === "USD") return `$${abs}`;
  if (currency === "EUR") return `€${abs}`;
  return abs;
}

export function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(n);
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatWhen(unixSec: number | null | undefined): string {
  if (!unixSec || !Number.isFinite(unixSec)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixSec * 1000));
}

export function formatClock(iso: string | number): string {
  const date = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toneOf(n: number | null | undefined): "gain" | "loss" | "flat" {
  if (n == null || !Number.isFinite(n) || n === 0) return "flat";
  return n > 0 ? "gain" : "loss";
}
