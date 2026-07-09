import { createFileRoute } from "@tanstack/react-router";
import { JuridicoAcervoHost } from "@/components/JuridicoAcervoHost";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/jurisprudencia")({
  component: () => <JuridicoAcervoHost modo="jurisprudencia" />,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});
