import { createFileRoute } from "@tanstack/react-router";
import { JuridicoHost } from "@/components/JuridicoHost";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/juridico")({
  component: JuridicoHost,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});
