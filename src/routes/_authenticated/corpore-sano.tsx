import { createFileRoute } from "@tanstack/react-router";
import { CorporeSanoHost } from "@/components/CorporeSanoHost";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/corpore-sano")({
  component: CorporeSanoHost,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});
