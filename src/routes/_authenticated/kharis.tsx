import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Heart, MessageSquareText, Mic, Sparkles, type LucideIcon } from "lucide-react";
import { ChatView } from "@/components/ChatView";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Button } from "@/components/ui/button";
import { ensureThread } from "@/lib/ensure-thread";

export const Route = createFileRoute("/_authenticated/kharis")({
  loader: async () => {
    const id = await ensureThread("kharis");
    return { threadId: id };
  },
  component: KharisHomePage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function KharisHomePage() {
  const { threadId } = Route.useLoaderData();

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#08080E] text-[#F3EBDD]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6 sm:py-8">
        <header className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C98A65]">
            Kháris · casa do cuidado
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="serif text-3xl sm:text-4xl">Cuidado, fala e aprendizagem.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#F3EBDD]/60">
                Kháris cuida. Klio ensina dentro dela. Aqui a conversa é simples, clara e
                respeitosa.
              </p>
            </div>
            <Button asChild className="h-11 rounded-full bg-[#7A1F2B] px-5 text-white">
              <Link to="/klio">
                <Mic className="mr-2 h-4 w-4" />
                Falar com Klio
              </Link>
            </Button>
          </div>
        </header>

        <section
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Caminhos de Kháris"
        >
          <KharisCard
            icon={Mic}
            title="Modo Fala Klio"
            text="Conversa simples, voz e apoio pedagógico."
            to="/klio"
            status="Funcional"
          />
          <KharisCard
            icon={BookOpen}
            title="Códice"
            text="Leitura, margem e fichamento assistido."
            to="/klio/codice"
            status="Assistido"
          />
          <KharisCard
            icon={Sparkles}
            title="Atividades"
            text="Atividades assistidas para estudo e rotina."
            status="Planejado"
          />
          <KharisCard
            icon={Heart}
            title="Rotina e cuidado"
            text="Acompanhamento calmo, literal e previsível."
            status="Nesta conversa"
          />
        </section>

        <section className="min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-[#0C0B12]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#F3EBDD]/45">
                Conversa de cuidado
              </p>
              <p className="mt-1 text-xs text-[#F3EBDD]/55">
                Motor técnico: Kháris. Klio não cria faceta separada.
              </p>
            </div>
            <MessageSquareText className="h-5 w-5 text-[#C98A65]" aria-hidden />
          </div>
          {threadId ? (
            <div className="h-[620px]">
              <ChatView threadId={threadId} />
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[#F3EBDD]/55">
              Iniciando conversa de cuidado...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KharisCard({
  icon: Icon,
  title,
  text,
  status,
  to,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  status: string;
  to?: string;
}) {
  const content = (
    <div className="flex h-full flex-col justify-between rounded-lg border border-white/10 bg-[#111016] p-4 transition hover:border-[#C98A65]/50">
      <div>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#7A1F2B]/20 text-[#F3EBDD]">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="serif text-xl text-[#F3EBDD]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#F3EBDD]/60">{text}</p>
      </div>
      <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-[#C98A65]">{status}</p>
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full focus:outline-none focus:ring-2 focus:ring-[#C98A65]">
      {content}
    </Link>
  ) : (
    content
  );
}
