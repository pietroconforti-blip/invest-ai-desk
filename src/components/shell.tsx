import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileSearch, LayoutDashboard, LineChart, Shield, Wallet } from "lucide-react";
import { MarketProvider } from "@/components/market-context";
import { cn } from "@/lib/cn";
import { MAX_ORDER_EUR, STARTING_CAPITAL_EUR } from "@/lib/ledger";
import { usePortfolio } from "@/lib/portfolio";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/research", label: "Research", icon: FileSearch },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/risk", label: "Risk", icon: Shield },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hydrated = usePortfolio((state) => state.hydrated);

  useEffect(() => {
    if (usePortfolio.getState().hydrated) return;
    let live = true;
    const done = () => {
      if (live) usePortfolio.setState({ hydrated: true });
    };
    const pending = usePortfolio.persist.rehydrate();
    if (pending instanceof Promise) void pending.then(done, done);
    else done();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-ivory">
      <div className="fixed inset-x-0 top-0 z-40">
        <div className="h-px bg-gold" />
        <div className="mt-1 h-px bg-gold/40" />
      </div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-ink md:flex">
        <div className="px-7 pt-10 pb-7">
          <p className="text-xs tracking-widest text-gold uppercase">Maison</p>
          <p className="mt-3 font-serif text-4xl leading-none tracking-tight">
            Invest<span className="text-gold">.</span>AI
          </p>
          <p className="mt-3 text-xs tracking-widest text-faint uppercase">Private paper desk</p>
        </div>
        <div className="mx-7 h-px bg-line" />
        <nav className="mt-6 flex flex-col gap-1 px-4" aria-label="Desk">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} active={pathname === item.to} />
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-7 py-6 text-xs text-faint">
          <p className="tracking-widest text-gold uppercase">Live trading off</p>
          <p className="mt-3 leading-relaxed">
            Opening capital €{STARTING_CAPITAL_EUR}. A paper order cannot exceed €{MAX_ORDER_EUR}.
          </p>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-4 backdrop-blur md:px-10">
          <p className="font-serif text-2xl md:hidden">
            Invest<span className="text-gold">.</span>AI
          </p>
          <p className="hidden text-xs tracking-widest text-faint uppercase md:block">Delayed prices · local book</p>
          <span className="border border-gold px-3 py-2 text-xs tracking-widest text-gold">Paper</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:px-10 md:py-10 md:pb-16">
          {hydrated ? <MarketProvider>{children}</MarketProvider> : <p className="text-sm text-muted">Opening the paper book…</p>}
          <footer className="mt-16 border-t border-line pt-5 text-xs leading-relaxed text-faint">
            INVEST.AI is not a broker and does not give investment advice. Orders stay on this device. Market figures can be delayed or missing.
          </footer>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-gold/50 bg-ink md:hidden" aria-label="Desk">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-xs", active ? "text-gold" : "text-faint")}
            >
              <Icon className="size-4" strokeWidth={1.25} aria-hidden="true" />
              {item.label === "Portfolio" ? "Book" : item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  icon: (typeof NAV)[number]["icon"];
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 items-center gap-3 border-l px-3 text-xs tracking-widest uppercase",
        active ? "border-gold text-ivory" : "border-transparent text-muted hover:text-ivory",
      )}
    >
      <Icon className="size-4" strokeWidth={1.25} aria-hidden="true" />
      {label}
    </Link>
  );
}
