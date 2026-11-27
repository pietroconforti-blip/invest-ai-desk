import { createFileRoute } from "@tanstack/react-router";
import { MarketsPage } from "@/components/markets-page";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/markets")({
  component: function Markets() {
    return (
      <Shell>
        <MarketsPage />
      </Shell>
    );
  },
});
