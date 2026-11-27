import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatEur, formatPct, toneOf } from "@/lib/format";

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-widest text-gold uppercase">{children}</p>;
}

export function PageIntro({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header>
      <Kicker>{kicker}</Kicker>
      <h1 className="mt-2 font-serif text-5xl leading-none tracking-tight">{title}</h1>
      {children ? <div className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">{children}</div> : null}
    </header>
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 px-5 text-xs font-medium tracking-widest uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" ? "bg-gold text-ink hover:bg-ivory" : "border border-line bg-transparent text-ivory hover:border-gold",
        className,
      )}
      {...props}
    />
  );
}

export function SignedEur({ value }: { value: number | null | undefined }) {
  const tone = toneOf(value);
  return (
    <span className={cn("tabular-nums", tone === "gain" && "text-gain", tone === "loss" && "text-loss", tone === "flat" && "text-muted")}>
      {formatEur(value, true)}
    </span>
  );
}

export function Change({ value }: { value: number | null | undefined }) {
  const tone = toneOf(value);
  return (
    <span className={cn("tabular-nums", tone === "gain" && "text-gain", tone === "loss" && "text-loss", tone === "flat" && "text-muted")}>
      {formatPct(value)}
    </span>
  );
}

export function Notice({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "bad" }) {
  return (
    <p className={cn("border border-line bg-ink-raised px-4 py-3 text-sm", tone === "bad" ? "border-loss/60 text-ivory" : "text-muted")} role={tone === "bad" ? "alert" : undefined}>
      {children}
    </p>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-xs tracking-widest text-faint uppercase">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const fieldClass =
  "h-11 w-full border border-line bg-ink px-3 text-base text-ivory outline-none placeholder:text-faint focus:border-gold";
