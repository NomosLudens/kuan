import { CodiceHost } from "@/components/CodiceHost";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/klio/codice")({
  component: CodicePage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function CodicePage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/klio/codice") return <Outlet />;

  return <CodiceHost />;
}
