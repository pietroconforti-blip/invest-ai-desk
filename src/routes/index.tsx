import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/overview-page";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/")({
  component: function Home() {
    return (
      <Shell>
        <OverviewPage />
      </Shell>
    );
  },
});
