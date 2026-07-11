import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessContext, upsertBusinessContext } from "@/lib/kuanyin.functions";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { CanonicalRules, normalizeAvailabilityRules } from "@/lib/kuan/availability-rules";

export const Route = createFileRoute("/_authenticated/kuan/config")({
  component: ConfigPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type Form = {
  id?: string;
  nome: string;
  tipo: string;
  tom_voz: string;
  pix_chave: string;
  observacoes: string;
  public_slug: string;
  servicos_text: string; // linhas livres
  precos_text: string;
  formas_pagamento_text: string;
  regras_agenda_text: string;
  limites_decisao_text: string;
  regras_escalonamento_text: string;
};

type GuardianMetadata = {
  guardian_preferences?: {
    tone_preference?: string;
    formality_level?: string;
    visual_style?: string;
    client_style?: string;
    preferred_cta?: string;
    autonomy_limits?: string[];
    must_review?: string[];
    avoid_terms?: string[];
    preferred_jargon?: string[];
    notes?: string;
  };
  public_page_blueprint?: {
    status?: string;
    theme?: { palette?: string; mood?: string; typography?: string };
    journey?: string[];
    sections?: unknown[];
    suggested_copy?: Record<string, unknown>;
    warnings?: string[];
  };
};

const EMPTY: Form = {
  nome: "",
  tipo: "",
  tom_voz: "",
  pix_chave: "",
  observacoes: "",
  public_slug: "",
  servicos_text: "",
  precos_text: "",
  formas_pagamento_text: "",
  regras_agenda_text: "",
  limites_decisao_text: "",
  regras_escalonamento_text: "",
};

function linesToArray(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
function textToJson(s: string): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const line of linesToArray(s)) {
    const idx = line.indexOf(":");
    if (idx > 0) obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    else obj[line] = "true";
  }
  return obj;
}
function arrayToLines(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join("\n");
  return "";
}

function slugifyPublicPath(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "guardiao";
}

function jsonToText(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${String(val)}`)
      .join("\n");
  }
  return "";
}

function ConfigPage() {
  const get = useServerFn(getBusinessContext);
  const upsert = useServerFn(upsertBusinessContext);
  const [form, setForm] = useState<Form>(EMPTY);
  const [rules, setRules] = useState<CanonicalRules>(normalizeAvailabilityRules(null));
  const [guardianMetadata, setGuardianMetadata] = useState<GuardianMetadata>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rawCtx = await get();
        const ctx = rawCtx as {
          id: string;
          nome: string | null;
          tipo: string | null;
          tom_voz: string | null;
          pix_chave: string | null;
          observacoes: string | null;
          servicos: unknown;
          precos: unknown;
          formas_pagamento: unknown;
          regras_agenda: unknown;
          limites_decisao: unknown;
          regras_escalonamento: unknown;
          public_slug?: string;
          guardian_metadata?: GuardianMetadata;
        } | null;
        if (ctx) {
          setForm({
            id: ctx.id,
            nome: ctx.nome ?? "",
            tipo: ctx.tipo ?? "",
            tom_voz: ctx.tom_voz ?? "",
            pix_chave: ctx.pix_chave ?? "",
            observacoes: ctx.observacoes ?? "",
            public_slug: typeof ctx.public_slug === "string" ? ctx.public_slug : "",
            servicos_text: arrayToLines(ctx.servicos),
            precos_text: jsonToText(ctx.precos),
            formas_pagamento_text: arrayToLines(ctx.formas_pagamento),
            regras_agenda_text: jsonToText(ctx.regras_agenda),
            limites_decisao_text: jsonToText(ctx.limites_decisao),
            regras_escalonamento_text: jsonToText(ctx.regras_escalonamento),
          });
          setRules(normalizeAvailabilityRules(ctx.regras_agenda));
          setGuardianMetadata(ctx.guardian_metadata ?? {});
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar contexto.");
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  const publicSlug = slugifyPublicPath(form.public_slug || form.nome || form.id || "");
  const publicPath = form.id ? `/g/${publicSlug}` : "";

  async function save() {
    if (!form.nome.trim()) {
      toast.error("Nome do negócio é obrigatório.");
      return;
    }
    try {
      const saved = (await upsert({
        data: {
          id: form.id,
          nome: form.nome.trim(),
          tipo: form.tipo.trim() || null,
          tom_voz: form.tom_voz.trim() || null,
          pix_chave: form.pix_chave.trim() || null,
          observacoes: form.observacoes.trim() || null,
          public_slug: publicSlug,
          servicos: linesToArray(form.servicos_text),
          precos: textToJson(form.precos_text),
          formas_pagamento: linesToArray(form.formas_pagamento_text),
          regras_agenda: {
            dias_atendimento: rules.days,
            hora_inicio: rules.startTime,
            hora_fim: rules.endTime,
            duracao_padrao_minutos: rules.defaultDurationMinutes,
            antecedencia_minima_horas: rules.minimumNoticeHours,
            bloquear_conflito_confirmado: rules.blockConfirmedConflicts,
            mensagem_indisponivel: rules.unavailableMessage,
            observacoes: rules.notes,
          } as any,
          limites_decisao: textToJson(form.limites_decisao_text),
          regras_escalonamento: textToJson(form.regras_escalonamento_text),
        },
      })) as { id?: string; public_slug?: string };
      setForm((current) => ({
        ...current,
        id: saved.id ?? current.id,
        public_slug: saved.public_slug ?? current.public_slug,
      }));
      toast.success("Contexto do negócio salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  if (loading) {
    return (
      <p className="max-w-3xl mx-auto px-4 py-6 text-sm text-[color:var(--ivory-dim)]">
        Carregando…
      </p>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="serif text-[color:var(--gold)] text-lg tracking-[0.18em] uppercase">
            Contexto do negócio
          </h1>
          <p className="text-xs text-[color:var(--ivory-dim)] mt-1">
            Manual vivo que a Kuan-Yin usa para atender. Tudo aqui entra no system prompt quando
            você conversa em <code>/kuan</code> e alimenta sua página pública de atendimento.
          </p>
          {form.id && (
            <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
              Página pública do Guardião:{" "}
              <code className="text-[color:var(--ivory)]">{publicPath}</code>
            </p>
          )}
        </div>
        {form.id && (
          <Button asChild variant="outline" className="shrink-0">
            <a href={publicPath} target="_blank" rel="noopener noreferrer">
              Abrir página pública
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </a>
          </Button>
        )}
      </div>

      {(guardianMetadata.guardian_preferences || guardianMetadata.public_page_blueprint) && (
        <section className="rounded-2xl border border-[color:var(--border)] bg-card/45 p-4 text-sm text-[color:var(--ivory-dim)]">
          <h2 className="serif text-[color:var(--ivory)] text-base">
            Preferências e proposta da Trilha
          </h2>
          {guardianMetadata.guardian_preferences && (
            <div className="mt-3 space-y-1">
              <p>
                <span className="text-[color:var(--ivory)]">CTA preferido:</span>{" "}
                {guardianMetadata.guardian_preferences.preferred_cta ?? "Solicitar esse horário"}
              </p>
              <p>
                <span className="text-[color:var(--ivory)]">Estilo visual:</span>{" "}
                {guardianMetadata.guardian_preferences.visual_style || "não informado"}
              </p>
              <p>
                <span className="text-[color:var(--ivory)]">Revisão obrigatória:</span>{" "}
                {(guardianMetadata.guardian_preferences.must_review ?? []).join(", ") ||
                  "não informado"}
              </p>
            </div>
          )}
          {guardianMetadata.public_page_blueprint && (
            <div className="mt-3 space-y-1">
              <p>
                <span className="text-[color:var(--ivory)]">Status da proposta:</span>{" "}
                {guardianMetadata.public_page_blueprint.status ?? "draft"}
              </p>
              <p>
                <span className="text-[color:var(--ivory)]">Jornada sugerida:</span>{" "}
                {(guardianMetadata.public_page_blueprint.journey ?? []).join(" → ") ||
                  "não informada"}
              </p>
              <p className="text-xs">
                A proposta é blueprint estruturado para revisão. HTML livre gerado por IA não é
                publicado automaticamente. Cliente sempre <strong>solicita</strong> horário; o
                Guardião confirma.
              </p>
            </div>
          )}
        </section>
      )}

      {!form.id && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/45 p-4 text-sm text-[color:var(--ivory-dim)]">
          Nenhum contexto de negócio encontrado. Preencha os campos reais do Guardião e salve para
          criar a página pública.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="nome">Nome do negócio</Label>
          <Input
            id="nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tipo">Tipo</Label>
          <Input
            id="tipo"
            placeholder="ex.: estética, advocacia, consultoria…"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="slug">Slug público</Label>
          <Input
            id="slug"
            placeholder="ex.: clinica-da-ana"
            value={form.public_slug}
            onChange={(e) => setForm({ ...form, public_slug: slugifyPublicPath(e.target.value) })}
          />
          <p className="text-[11px] text-[color:var(--ivory-dim)]">
            Esse texto forma o link público estável do Guardião. Use apenas letras, números e
            hífens.
          </p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="tom">Tom de voz</Label>
          <Input
            id="tom"
            placeholder="ex.: cuidadoso, direto, acolhedor sem informalidade excessiva"
            value={form.tom_voz}
            onChange={(e) => setForm({ ...form, tom_voz: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="serv">Serviços (um por linha)</Label>
          <Textarea
            id="serv"
            rows={4}
            value={form.servicos_text}
            onChange={(e) => setForm({ ...form, servicos_text: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="precos">Preços / faixas (chave: valor, uma por linha)</Label>
          <Textarea
            id="precos"
            rows={3}
            value={form.precos_text}
            onChange={(e) => setForm({ ...form, precos_text: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pag">Formas de pagamento (uma por linha)</Label>
          <Textarea
            id="pag"
            rows={3}
            value={form.formas_pagamento_text}
            onChange={(e) => setForm({ ...form, formas_pagamento_text: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pix">Chave Pix</Label>
          <Input
            id="pix"
            value={form.pix_chave}
            onChange={(e) => setForm({ ...form, pix_chave: e.target.value })}
          />
        </div>
        <div className="space-y-4 sm:col-span-2 border border-[color:var(--border)] rounded-2xl p-5 bg-card/40 backdrop-blur-md">
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-[color:var(--gold)] uppercase">
              Regras de Agenda
            </h3>
            <p className="text-xs text-[color:var(--ivory-dim)] mt-1">
              Essas regras orientam a página pública. O Guardião ainda confirma cada solicitação.
            </p>
          </div>

          {/* 1. Dias de atendimento */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]">
              Dias de atendimento
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Dom", value: 0 },
                { label: "Seg", value: 1 },
                { label: "Ter", value: 2 },
                { label: "Qua", value: 3 },
                { label: "Qui", value: 4 },
                { label: "Sex", value: 5 },
                { label: "Sáb", value: 6 },
              ].map((day) => {
                const checked = rules.days.includes(day.value);
                return (
                  <label
                    key={day.value}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                      checked
                        ? "bg-[color:var(--gold)]/20 border-[color:var(--gold)] text-[color:var(--gold)]"
                        : "bg-transparent border-[color:var(--border)] text-[color:var(--ivory-dim)] hover:border-[color:var(--ivory-dim)]/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => {
                        const newDays = e.target.checked
                          ? [...rules.days, day.value].sort((a, b) => a - b)
                          : rules.days.filter((d) => d !== day.value);
                        setRules({ ...rules, days: newDays });
                      }}
                    />
                    <span>{day.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2. Horário inicial */}
            <div className="space-y-1">
              <Label
                htmlFor="hora_inicio"
                className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]"
              >
                Horário inicial
              </Label>
              <Input
                id="hora_inicio"
                type="time"
                value={rules.startTime ?? ""}
                onChange={(e) => setRules({ ...rules, startTime: e.target.value || null })}
              />
            </div>

            {/* 3. Horário final */}
            <div className="space-y-1">
              <Label
                htmlFor="hora_fim"
                className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]"
              >
                Horário final
              </Label>
              <Input
                id="hora_fim"
                type="time"
                value={rules.endTime ?? ""}
                onChange={(e) => setRules({ ...rules, endTime: e.target.value || null })}
              />
            </div>

            {/* 4. Duração padrão */}
            <div className="space-y-1">
              <Label
                htmlFor="duracao"
                className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]"
              >
                Duração padrão (minutos)
              </Label>
              <Input
                id="duracao"
                type="number"
                min={15}
                step={15}
                value={rules.defaultDurationMinutes}
                onChange={(e) =>
                  setRules({ ...rules, defaultDurationMinutes: parseInt(e.target.value) || 60 })
                }
              />
            </div>

            {/* 5. Antecedência mínima */}
            <div className="space-y-1">
              <Label
                htmlFor="antecedencia"
                className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]"
              >
                Antecedência mínima (horas)
              </Label>
              <Input
                id="antecedencia"
                type="number"
                min={0}
                value={rules.minimumNoticeHours}
                onChange={(e) =>
                  setRules({ ...rules, minimumNoticeHours: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          {/* 6. Bloquear conflitos */}
          <div className="flex items-center gap-2 py-2">
            <input
              id="bloquear_conflitos"
              type="checkbox"
              className="rounded border-[color:var(--border)] bg-transparent text-[color:var(--gold)] focus:ring-[color:var(--gold)] w-4 h-4 cursor-pointer"
              checked={rules.blockConfirmedConflicts}
              onChange={(e) => setRules({ ...rules, blockConfirmedConflicts: e.target.checked })}
            />
            <Label
              htmlFor="bloquear_conflitos"
              className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)] cursor-pointer"
            >
              Bloquear conflitos com horários confirmados
            </Label>
          </div>

          {/* 7. Observações públicas */}
          <div className="space-y-1">
            <Label
              htmlFor="obs_agenda"
              className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]"
            >
              Observações públicas (mostradas aos clientes)
            </Label>
            <Textarea
              id="obs_agenda"
              rows={2}
              placeholder="Ex: Atendimentos mediante confirmação."
              value={rules.notes ?? ""}
              onChange={(e) => setRules({ ...rules, notes: e.target.value || null })}
            />
          </div>

          {/* 8. Mensagem para horário indisponível */}
          <div className="space-y-1">
            <Label
              htmlFor="msg_indisponivel"
              className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ivory-dim)]"
            >
              Mensagem para horário indisponível
            </Label>
            <Textarea
              id="msg_indisponivel"
              rows={2}
              placeholder="Ex: Esse horário está fora das regras de atendimento do Guardião. Escolha outro horário ou envie uma observação."
              value={rules.unavailableMessage}
              onChange={(e) => setRules({ ...rules, unavailableMessage: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="lim">Limites de decisão (o que a IA pode resolver sozinha)</Label>
          <Textarea
            id="lim"
            rows={3}
            placeholder={"propor_agendamento: sim\ndesconto_maximo: 10%"}
            value={form.limites_decisao_text}
            onChange={(e) => setForm({ ...form, limites_decisao_text: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="esc">Regras de escalonamento (quando passar para o humano)</Label>
          <Textarea
            id="esc"
            rows={3}
            placeholder={"reclamacao: sempre\nvalor_acima: 500"}
            value={form.regras_escalonamento_text}
            onChange={(e) => setForm({ ...form, regras_escalonamento_text: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="obs">Observações livres</Label>
          <Textarea
            id="obs"
            rows={3}
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar contexto</Button>
      </div>
    </div>
  );
}
