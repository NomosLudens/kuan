// Kaline Presente — experiência voice-first real para o admin.
// Rota: /kaline-presente | Admin-only

import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureThread } from "@/lib/ensure-thread";
import { KalinePresenteView } from "@/components/KalinePresenteView";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kaline-presente")({
  loader: async () => {
    const { getAuthz } = await import("@/lib/use-authz");
    const authz = await getAuthz();
    if (!authz.isAdmin) throw redirect({ to: "/" });

    const id = await ensureThread("kaline");
    return { threadId: id };
  },
  component: KalinePresentePage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function KalinePresentePage() {
  const { threadId } = Route.useLoaderData();
  return <KalinePresenteView threadId={threadId ?? ""} />;
}
