import { createFileRoute } from "@tanstack/react-router";
import { PortfolioPage } from "@/components/portfolio-page";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/portfolio")({
  component: function Portfolio() {
    return (
      <Shell>
        <PortfolioPage />
      </Shell>
    );
  },
});
