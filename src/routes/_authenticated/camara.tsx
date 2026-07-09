import { createFileRoute } from "@tanstack/react-router";
import { CamaraHost } from "@/components/CamaraHost";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/camara")({
  component: CamaraHost,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});
