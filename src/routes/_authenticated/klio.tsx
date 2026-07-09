// Klio — experiência voice-first real baseada na Kháris (facet="kharis").
// Rota: /klio | Compatível com: /modo-fala

import { KlioVoiceView } from "@/components/KlioVoiceView";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ensureThread } from "@/lib/ensure-thread";

export const Route = createFileRoute("/_authenticated/klio")({
  loader: async () => {
    const id = await ensureThread("kharis");
    return { threadId: id };
  },
  component: KlioPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function KlioPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { threadId } = Route.useLoaderData();

  if (pathname !== "/klio") return <Outlet />;

  return <KlioVoiceView threadId={threadId ?? ""} />;
}
