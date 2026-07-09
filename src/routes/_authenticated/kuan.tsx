import { createFileRoute } from "@tanstack/react-router";
import { ensureThread } from "@/lib/ensure-thread";
import { ChatView } from "@/components/ChatView";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan")({
  loader: async () => {
    const id = await ensureThread("kuanyin");
    return { threadId: id };
  },
  component: KuanChatPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function KuanChatPage() {
  const { threadId } = Route.useLoaderData();

  if (!threadId) {
    return (
      <div className="p-8 text-center text-[color:var(--ivory-dim)]">
        Iniciando conversa comercial...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatView threadId={threadId} />
    </div>
  );
}
