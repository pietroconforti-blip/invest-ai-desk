import { createFileRoute } from "@tanstack/react-router";
import { RiskPage } from "@/components/risk-page";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/risk")({
  component: function Risk() {
    return (
      <Shell>
        <RiskPage />
      </Shell>
    );
  },
});
