// Trilha do Guardião: coleta contexto operacional, preferências internas e
// blueprint seguro da futura página pública. Não publica automaticamente.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { upsertBusinessContext } from "@/lib/kuanyin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan/onboarding")({
  component: OnboardingPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type Step = {
  key: string;
  title: string;
  prompt: string;
  placeholder?: string;
  multiline?: boolean;
};

const STEPS: Step[] = [
  {
    key: "nome",
    title: "Como o negócio se chama?",
    prompt: "Diga o nome que você usa para falar do negócio com clientes.",
    placeholder: "ex.: Studio Lúcia · Massoterapia",
  },
  {
    key: "tipo",
    title: "Qual o tipo de negócio?",
    prompt: "Em uma frase, o que você faz.",
    placeholder: "ex.: estética facial · advocacia trabalhista · consultoria de marca",
  },
  {
    key: "servicos_text",
    title: "Quais serviços ofereço?",
    prompt: "Um por linha. Pode listar os mais comuns; a gente refina depois.",
    placeholder: "Massagem relaxante\nLimpeza de pele\nConsulta inicial",
    multiline: true,
  },
  {
    key: "tom_voz",
    title: "Qual o tom de voz com clientes?",
    prompt: "Como você quer ser ouvido. Pense em três palavras.",
    placeholder: "ex.: cuidadoso, direto, sem informalidade excessiva",
  },
  {
    key: "formas_pagamento_text",
    title: "Formas de pagamento aceitas?",
    prompt: "Uma por linha.",
    placeholder: "Pix\nDinheiro\nCartão (Stone)",
    multiline: true,
  },
  { key: "pix_chave", title: "Qual a chave Pix?", prompt: "Se houver. Pode pular." },
  {
    key: "client_style",
    title: "Como seus melhores clientes gostam de ser atendidos?",
    prompt: "Descreva o estilo de cliente, dúvidas comuns e o que deixa a venda confortável.",
    placeholder: "ex.: clientes com pouco tempo, gostam de objetividade e prova visual",
    multiline: true,
  },
  {
    key: "visual_style",
    title: "Qual estilo visual combina com a página pública?",
    prompt: "Cores, clima, referências e o que deve ser evitado.",
    placeholder: "ex.: claro, delicado, com fotos reais do portfólio; evitar promessas exageradas",
    multiline: true,
  },
  {
    key: "autonomy_limits_text",
    title: "O que a Kuan nunca deve decidir sozinha?",
    prompt: "Um limite por linha. Isso vira regra interna do Guardião.",
    placeholder: "Confirmar horário\nConfirmar pagamento\nDar desconto fora da tabela",
    multiline: true,
  },
  {
    key: "must_review_text",
    title: "O que precisa de revisão humana?",
    prompt: "Um item por linha. A proposta pública fica pendente até Guardião/Admin aprovar.",
    placeholder: "Textos da página pública\nHorários solicitados\nComprovantes enviados",
    multiline: true,
  },
];

const DEFAULT_PUBLIC_JOURNEY = [
  "chegada",
  "servicos",
  "referencias",
  "agenda",
  "pagamento_pendente",
  "revisao_humana",
];

const DEFAULT_BLUEPRINT_WARNINGS = [
  "Pedido de agendamento depende de confirmação do Guardião.",
  "Comprovante recebido não é pagamento confirmado.",
];

function linesToArray(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function OnboardingPage() {
  const upsert = useServerFn(upsertBusinessContext);
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const step = STEPS[i];

  function next(skip = false) {
    if (!step) return;
    if (!skip) setAnswers((a) => ({ ...a, [step.key]: val.trim() }));
    setVal("");
    setI((x) => x + 1);
  }
  function back() {
    if (i === 0) return;
    setI((x) => x - 1);
    setVal(answers[STEPS[i - 1].key] ?? "");
  }

  async function finalize() {
    const a = answers;
    if (!a.nome) {
      toast.error("Nome do negócio é obrigatório.");
      setI(0);
      return;
    }
    setSaving(true);
    try {
      const servicos = linesToArray(a.servicos_text);
      const formasPagamento = linesToArray(a.formas_pagamento_text);
      const autonomyLimits = linesToArray(a.autonomy_limits_text);
      const mustReview = linesToArray(a.must_review_text);
      await upsert({
        data: {
          nome: a.nome,
          tipo: a.tipo || null,
          tom_voz: a.tom_voz || null,
          pix_chave: a.pix_chave || null,
          servicos,
          formas_pagamento: formasPagamento,
          limites_decisao: {
            cliente_pode_solicitar_horario: true,
            kuan_nao_confirma_agendamento: true,
            limites_do_guardiao: autonomyLimits,
          },
          regras_escalonamento: {
            revisao_humana: mustReview,
          },
          guardian_preferences: {
            tone_preference: a.tom_voz || "",
            formality_level: "mixed",
            visual_style: a.visual_style || "",
            client_style: a.client_style || "",
            preferred_cta: "Solicitar esse horário",
            autonomy_limits: autonomyLimits,
            must_review: mustReview,
            avoid_terms: ["Confirmar esse horário"],
            preferred_jargon: servicos,
            notes: "Preferências coletadas pela Trilha do Guardião; revisar antes de publicar.",
          },
          public_page_blueprint: {
            status: "proposed",
            theme: {
              palette: a.visual_style || "a definir pelo Guardião",
              mood: a.tom_voz || "conversacional e humano",
              typography: "legível em mobile",
            },
            journey: DEFAULT_PUBLIC_JOURNEY,
            sections: [
              { key: "chegada", label: "Pergunta inicial" },
              { key: "servicos", label: "Escolha de serviço/estilo" },
              { key: "referencias", label: "Referências/portfólio" },
              { key: "agenda", label: "Solicitação de horário" },
              { key: "pagamento_pendente", label: "Pagamento pendente/comprovante" },
              { key: "revisao_humana", label: "Aviso de confirmação humana" },
            ],
            suggested_copy: {
              primary_cta: "Solicitar esse horário",
              arrival_question: `Oi, eu sou a Kuan deste atendimento. O que você quer resolver com ${a.nome}?`,
              human_review_notice:
                "Seu pedido será revisado pelo Guardião antes de confirmação de agenda ou pagamento.",
            },
            warnings: DEFAULT_BLUEPRINT_WARNINGS,
          },
        },
      });
      toast.success("Trilha salva: contexto, preferências e proposta de página.");
      navigate({ to: "/kuan/config" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-6">
      <div className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--ivory-dim)] mb-2">
        Trilha do Guardião · passo {Math.min(i + 1, STEPS.length)} de {STEPS.length}
      </div>
      {step ? (
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/40 p-4 space-y-3">
          <div className="serif text-[color:var(--gold)] text-base tracking-[0.18em] uppercase">
            {step.title}
          </div>
          <p className="text-sm text-[color:var(--ivory-dim)]">{step.prompt}</p>
          <div className="space-y-1">
            <Label htmlFor="resp" className="sr-only">
              Resposta
            </Label>
            {step.multiline ? (
              <Textarea
                id="resp"
                rows={5}
                value={val}
                placeholder={step.placeholder}
                onChange={(e) => setVal(e.target.value)}
              />
            ) : (
              <Input
                id="resp"
                value={val}
                placeholder={step.placeholder}
                onChange={(e) => setVal(e.target.value)}
              />
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" disabled={i === 0} onClick={back}>
              Voltar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => next(true)}>
                Pular
              </Button>
              <Button size="sm" onClick={() => next(false)}>
                Próximo
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/40 p-4 space-y-3">
          <div className="serif text-[color:var(--gold)] text-base tracking-[0.18em] uppercase">
            Pronto para salvar a Trilha
          </div>
          <p className="text-sm text-[color:var(--ivory-dim)]">
            Revise. A Trilha salva contexto operacional, preferências internas e uma proposta
            estruturada de página pública. Nada é publicado automaticamente.
          </p>
          <ul className="text-sm text-[color:var(--ivory)] space-y-1">
            {STEPS.map((s) => (
              <li key={s.key}>
                <span className="text-[color:var(--ivory-dim)]">{s.title}</span>
                <div className="whitespace-pre-wrap pl-2 border-l border-[color:var(--border)] mt-1 text-[12px]">
                  {answers[s.key] || (
                    <span className="text-[color:var(--ivory-dim)] italic">(em branco)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setI(0);
                setVal(answers[STEPS[0].key] ?? "");
              }}
            >
              Revisar do início
            </Button>
            <Button size="sm" disabled={saving} onClick={finalize}>
              {saving ? "Salvando…" : "Salvar Trilha"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
