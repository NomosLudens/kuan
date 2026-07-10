import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan")({
  component: KuanLayout,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function KuanLayout() {
  return <Outlet />;
}
