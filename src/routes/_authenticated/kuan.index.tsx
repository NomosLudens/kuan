import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Settings, ShieldCheck, Store } from "lucide-react";
import { kuanyinApple } from "@/lib/brand-assets";
import { Button } from "@/components/ui/button";
import { ensureThread } from "@/lib/ensure-thread";
import { ChatView } from "@/components/ChatView";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan/")({
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header com CTAs secundários */}
      <header className="flex-none border-b border-[color:var(--border)] bg-card/40 p-3 sm:p-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={kuanyinApple.url}
              alt=""
              className="h-10 w-10 shrink-0 apple-glow"
              style={{ filter: "drop-shadow(0 0 10px rgba(236, 72, 153, 0.45))" }}
            />
            <div className="min-w-0">
              <h1 className="serif text-xl sm:text-2xl text-[color:oklch(0.86_0.06_350)] truncate">
                Conversa com Kuan
              </h1>
              <p className="text-xs text-[color:var(--ivory-dim)] truncate">
                Superfície principal do Guardião
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
              <Link to="/kuan/onboarding">
                <Settings className="mr-1.5 h-3.5 w-3.5" /> Configurar
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
              <Link to="/kuan/inbox">
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Atendimentos
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
              <Link to="/kuan/guardioes">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Guardiões
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
              <Link to="/kuan/showroom">
                <Store className="mr-1.5 h-3.5 w-3.5" /> Showroom
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Container do Chat */}
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl">
        {threadId ? (
          <ChatView threadId={threadId} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-[color:var(--ivory-dim)]">
            Iniciando conversa...
          </div>
        )}
      </main>
    </div>
  );
}
