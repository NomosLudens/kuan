import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGuardianPublicPage } from "@/lib/kuanyin-public.functions";
import { kuanyinApple } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/g/$guardianId")({
  component: GuardianPublicPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
  head: () => ({
    meta: [
      { title: "Atendimento · Kuan-Yin" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "description", content: "Página pública do Guardião com dados comerciais." },
    ],
  }),
});

type PublicState =
  | {
      ok: true;
      guardian: {
        slug: string;
        name: string;
        type: string | null;
        tone: string | null;
        services: string[];
        prices: string[];
        paymentMethods: string[];
        scheduleRules: string[];
        notes: string | null;
        canonicalPath: string;
      };
    }
  | { ok: false; reason: string }
  | null;

function GuardianPublicPage() {
  const { guardianId } = Route.useParams();
  const getPage = useServerFn(getGuardianPublicPage);
  const [state, setState] = useState<PublicState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const pageState = (await getPage({ data: { guardianId } })) as PublicState;
        if (active) setState(pageState);
      } catch {
        if (active) setState({ ok: false, reason: "read_error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getPage, guardianId]);

  const publicDataCount = useMemo(() => {
    if (!state?.ok) return 0;
    const guardian = state.guardian;
    return [
      guardian.type,
      guardian.tone,
      guardian.notes,
      ...guardian.services,
      ...guardian.prices,
      ...guardian.paymentMethods,
      ...guardian.scheduleRules,
    ].filter(Boolean).length;
  }, [state]);

  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-[color:var(--ivory-dim)]">Carregando página pública…</p>
      </Shell>
    );
  }

  if (!state || !state.ok) {
    const message =
      state?.reason === "read_error"
        ? "Não foi possível ler esta página agora."
        : "Nenhum Guardião publicado foi encontrado para este slug.";
    return (
      <Shell>
        <Notice title="Página indisponível" text={message} />
      </Shell>
    );
  }

  const guardian = state.guardian;
  const hasPublicData = publicDataCount > 0;

  return (
    <Shell>
      <section className="space-y-5">
        <div className="rounded-3xl border border-[color:var(--border)] bg-card/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7">
          <Badge className="mb-3 bg-[color:oklch(0.69_0.22_350/0.22)] text-[color:var(--ivory)]">
            Página pública · Kuan-Yin
          </Badge>
          <h1 className="serif text-3xl text-[color:var(--ivory)] sm:text-4xl">{guardian.name}</h1>
          {guardian.type && (
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[color:var(--gold)]">
              {guardian.type}
            </p>
          )}
          {guardian.tone && (
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ivory-dim)]">
              Atendimento: {guardian.tone}
            </p>
          )}
          {guardian.notes && (
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ivory)]">
              {guardian.notes}
            </p>
          )}
          <p className="mt-4 text-xs text-[color:var(--ivory-dim)]">
            Link público:{" "}
            <code className="text-[color:var(--ivory)]">{guardian.canonicalPath}</code>
          </p>
        </div>

        {!hasPublicData && (
          <Notice
            title="Negócio sem dados públicos suficientes"
            text="O Guardião já tem uma página pública, mas ainda não publicou detalhes comerciais."
          />
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <InfoCard title="Serviços">
            <List values={guardian.services} empty="Serviços ainda não publicados." />
          </InfoCard>
          <InfoCard title="Preços / faixas">
            <List values={guardian.prices} empty="Preços ainda não publicados." />
          </InfoCard>
          <InfoCard title="Formas de pagamento">
            <List
              values={guardian.paymentMethods}
              empty="Formas de pagamento ainda não publicadas."
            />
          </InfoCard>
          <InfoCard title="Agenda">
            <List values={guardian.scheduleRules} empty="Regras de agenda ainda não publicadas." />
          </InfoCard>
        </div>

        <div className="rounded-3xl border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 p-5 text-sm leading-relaxed text-[color:var(--ivory)]">
          <p>Pedidos, agendamentos e pagamentos dependem de confirmação do Guardião.</p>
          <p className="mt-2">Comprovante recebido não é pagamento confirmado.</p>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-[color:var(--ivory)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <img
            src={kuanyinApple.url}
            alt=""
            className="h-7 w-7"
            style={{ filter: "drop-shadow(0 0 8px rgba(236,72,153,0.45))" }}
          />
          <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--ivory-dim)]">
            presença pública · Kuan-Yin
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-card/45 p-5">
      <h2 className="serif mb-4 text-xl text-[color:var(--ivory)]">{title}</h2>
      {children}
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-card/50 p-5">
      <h1 className="serif text-xl text-[color:var(--ivory)]">{title}</h1>
      <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">{text}</p>
    </div>
  );
}

function List({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p className="text-sm text-[color:var(--ivory-dim)]">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-[color:var(--ivory)]">
      {values.map((value) => (
        <li key={value}>• {value}</li>
      ))}
    </ul>
  );
}
