import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Settings } from "lucide-react";
import { kuanyinApple } from "@/lib/brand-assets";
import { Button } from "@/components/ui/button";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan")({
  component: KuanPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function KuanPage() {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col justify-center px-4 py-10 sm:px-6">
      <section className="rounded-[2rem] border border-[color:var(--border)] bg-card/60 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <img
            src={kuanyinApple.url}
            alt=""
            className="h-16 w-16 shrink-0"
            style={{ filter: "drop-shadow(0 0 14px rgba(236, 72, 153, 0.45))" }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--ivory-dim)]">
              Kuan · superfície principal
            </p>
            <h1 className="serif mt-2 text-3xl text-[color:oklch(0.86_0.06_350)] sm:text-4xl">
              Configure seu negócio antes de atender.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--ivory-dim)]">
              Kuan-Yin continua sendo a marca visual, mas a rota principal é /kuan. O primeiro
              passo real é registrar nome, serviços, tom de voz e regras do Guardião.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button asChild className="h-12 justify-between rounded-2xl px-5">
            <Link to="/kuan/onboarding">
              <span className="inline-flex items-center gap-2">
                <Settings className="h-4 w-4" /> Configurar negócio
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 justify-between rounded-2xl px-5">
            <Link to="/kuan/inbox">
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Ver atendimentos
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
