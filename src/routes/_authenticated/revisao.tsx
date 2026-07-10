import { createFileRoute } from "@tanstack/react-router";
import { RevisaoHost } from "@/components/RevisaoHost";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

function RevisaoPage() {
  return <RevisaoHost />;
}

export const Route = createFileRoute("/_authenticated/revisao")({
  component: RevisaoPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});
