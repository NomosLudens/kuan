// Onboarding conversacional para preencher o `business_context`.
// Wizard simples em 6 passos, salva no final via upsertBusinessContext.
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

export const Route = createFileRoute("/_authenticated/kuan-yin/onboarding")({
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
];

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
      await upsert({
        data: {
          nome: a.nome,
          tipo: a.tipo || null,
          tom_voz: a.tom_voz || null,
          pix_chave: a.pix_chave || null,
          servicos: (a.servicos_text ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          formas_pagamento: (a.formas_pagamento_text ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      toast.success("Contexto do negócio salvo.");
      navigate({ to: "/kuan-yin/config" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-6">
      <div className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--ivory-dim)] mb-2">
        Onboarding · passo {Math.min(i + 1, STEPS.length)} de {STEPS.length}
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
            Pronto para gravar
          </div>
          <p className="text-sm text-[color:var(--ivory-dim)]">
            Revise. Você pode editar tudo depois em <code>/kuan-yin/config</code>.
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
              {saving ? "Salvando…" : "Salvar contexto"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
