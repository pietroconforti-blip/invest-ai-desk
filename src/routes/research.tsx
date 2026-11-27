import { createFileRoute } from "@tanstack/react-router";
import { ResearchPage } from "@/components/research-page";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/research")({
  validateSearch: (search: Record<string, unknown>) => ({
    symbol: typeof search.symbol === "string" ? search.symbol.toUpperCase().slice(0, 16) : "",
  }),
  component: function Research() {
    const { symbol } = Route.useSearch();
    return (
      <Shell>
        <ResearchPage initialSymbol={symbol} />
      </Shell>
    );
  },
});
