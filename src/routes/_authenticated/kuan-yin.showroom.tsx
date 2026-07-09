import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

const SHOWROOM_URL = "https://showroom.nomosludens.ia.br";

export const Route = createFileRoute("/_authenticated/kuan-yin/showroom")({
  component: ShowroomPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function ShowroomPage() {
  return (
    <section className="h-full min-h-0 overflow-hidden bg-background">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:oklch(0.69_0.22_350/0.35)] bg-[color:oklch(0.69_0.22_350/0.12)] text-[color:oklch(0.86_0.06_350)]">
                <MonitorPlay className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="serif text-xl sm:text-2xl text-[color:var(--ivory)]">
                  Showroom Kuan-Yin
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--ivory-dim)]">
                  Mostruário vivo da experiência comercial, aberto dentro do app sem login
                  adicional.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full sm:w-auto shrink-0">
              <a href={SHOWROOM_URL} target="_blank" rel="noopener noreferrer">
                Abrir em nova aba
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative min-h-[58dvh] flex-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-black p-1 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <iframe
            title="Showroom Kuan-Yin"
            src={SHOWROOM_URL}
            className="h-full min-h-[58dvh] w-full rounded-xl border-0 bg-white"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen"
          />
        </div>

        <p className="px-1 text-xs leading-relaxed text-[color:var(--ivory-dim)]">
          Se o navegador, WebView ou as políticas de segurança do site impedirem a incorporação, use
          “Abrir em nova aba” para acessar o showroom diretamente.
        </p>
      </div>
    </section>
  );
}
