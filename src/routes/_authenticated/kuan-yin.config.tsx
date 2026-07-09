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

export const Route = createFileRoute("/_authenticated/kuan-yin/config")({
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
  formas_pagamento_text: string;
  regras_agenda_text: string;
  limites_decisao_text: string;
  regras_escalonamento_text: string;
};

const EMPTY: Form = {
  nome: "",
  tipo: "",
  tom_voz: "",
  pix_chave: "",
  observacoes: "",
  public_slug: "",
  servicos_text: "",
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
          formas_pagamento: unknown;
          regras_agenda: unknown;
          limites_decisao: unknown;
          regras_escalonamento: unknown;
          public_slug?: string;
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
            formas_pagamento_text: arrayToLines(ctx.formas_pagamento),
            regras_agenda_text: jsonToText(ctx.regras_agenda),
            limites_decisao_text: jsonToText(ctx.limites_decisao),
            regras_escalonamento_text: jsonToText(ctx.regras_escalonamento),
          });
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
      await upsert({
        data: {
          id: form.id,
          nome: form.nome.trim(),
          tipo: form.tipo.trim() || null,
          tom_voz: form.tom_voz.trim() || null,
          pix_chave: form.pix_chave.trim() || null,
          observacoes: form.observacoes.trim() || null,
          public_slug: publicSlug,
          servicos: linesToArray(form.servicos_text),
          formas_pagamento: linesToArray(form.formas_pagamento_text),
          regras_agenda: textToJson(form.regras_agenda_text),
          limites_decisao: textToJson(form.limites_decisao_text),
          regras_escalonamento: textToJson(form.regras_escalonamento_text),
        },
      });
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
            você conversa em <code>/kuan-yin</code> e alimenta sua página pública de atendimento.
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
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="agenda">Regras de agenda (chave: valor, uma por linha)</Label>
          <Textarea
            id="agenda"
            rows={3}
            placeholder={"horario_inicio: 09:00\nhorario_fim: 18:00\ndias: seg-sex"}
            value={form.regras_agenda_text}
            onChange={(e) => setForm({ ...form, regras_agenda_text: e.target.value })}
          />
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
