import { createFileRoute } from "@tanstack/react-router";
import { KuanPlanPage } from "@/features/kuan-plan/KuanPlanPage";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan/plano")({
  component: KuanPlanPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});
