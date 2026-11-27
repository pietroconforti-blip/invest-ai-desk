import { useEffect, useState } from "react";
import { Area, AreaChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { cn } from "@/lib/cn";
import { formatEur } from "@/lib/format";
import { STARTING_CAPITAL_EUR } from "@/lib/ledger";

function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export function Sparkline({ values, tone }: { values: number[]; tone: "gain" | "loss" | "flat" }) {
  const ready = useReady();
  if (!ready || values.length < 2) return <div className="h-9 w-24" />;
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className={cn("h-9 w-24", tone === "gain" && "text-gain", tone === "loss" && "text-loss", tone === "flat" && "text-muted")} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke="currentColor" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EquityChart({ points }: { points: { t: number; equity: number }[] }) {
  const ready = useReady();
  if (points.length < 2 || !ready) {
    const latest = points[points.length - 1]?.equity ?? STARTING_CAPITAL_EUR;
    const scale = Math.max(latest, STARTING_CAPITAL_EUR, 1);
    return (
      <div>
        <Bar label="Starting capital" value={STARTING_CAPITAL_EUR} width={STARTING_CAPITAL_EUR / scale} gold />
        <div className="mt-4">
          <Bar label="Marked now" value={latest} width={latest / scale} gold={false} />
        </div>
        <p className="mt-4 text-xs text-faint">A line is drawn only after the book has been marked more than once. History is not backfilled.</p>
      </div>
    );
  }

  const data = points.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(point.t),
  }));

  return (
    <div className="h-52 text-gold">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value) => formatEur(typeof value === "number" ? value : null)}
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")}
            contentStyle={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
              borderRadius: 2,
              color: "var(--color-ivory)",
            }}
          />
          <Area type="monotone" dataKey="equity" stroke="currentColor" fill="var(--color-gold)" fillOpacity={0.12} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Bar({ label, value, width, gold }: { label: string; value: number; width: number; gold: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{formatEur(value)}</span>
      </div>
      <div className="mt-2 h-px bg-line">
        <div className={cn("h-px", gold ? "bg-gold" : "bg-ivory")} style={{ width: `${Math.max(2, Math.min(100, width * 100))}%` }} />
      </div>
    </div>
  );
}

const SLICE_COLORS = ["var(--color-ivory)", "var(--color-gold)", "var(--color-muted)", "var(--color-gold-dim)", "var(--color-faint)"];

export function Allocation({ slices }: { slices: { name: string; value: number }[] }) {
  const ready = useReady();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;
  if (slices.length < 2 || !ready) {
    return <p className="text-sm text-muted">{slices.length === 1 ? `Entirely ${slices[0]?.name.toLowerCase()}.` : "No allocation to draw."}</p>;
  }
  const colored = slices.map((slice, index) => ({ ...slice, color: SLICE_COLORS[index % SLICE_COLORS.length] ?? SLICE_COLORS[0] }));
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[9rem_1fr]">
      <div className="mx-auto h-36 w-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={colored} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} stroke="transparent" paddingAngle={2} isAnimationActive={false}>
              {colored.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2">
        {colored.map((slice) => (
          <li key={slice.name} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0" style={{ background: slice.color }} aria-hidden="true" />
              <span className="truncate">{slice.name}</span>
            </span>
            <span className="tabular-nums text-muted">{((slice.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

