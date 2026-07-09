// Câmara de Eco — Fase 2 (análise) e Fase 3 (ações revisáveis).
//
// Ética do módulo: a análise NUNCA vira memória sozinha. O servidor
// devolve uma síntese estruturada que o humano decide o que fazer.
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ────────────────────────────────────────────────────────────────────
// Schema da análise
// ────────────────────────────────────────────────────────────────────
const InterlocutorSchema = z.object({
  nome: z.string().describe("Nome OU descrição funcional ('voz feminina', 'cliente do caso X')"),
  confianca: z
    .enum(["provavel", "possivel", "hipotetico"])
    .describe("Nunca afirmar identidade sem evidência clara na transcrição"),
});

// Tetos generosos + defaults: reuniões longas com muitos participantes geravam
// mais itens que os limites antigos (8/10), o que fazia o Zod rejeitar a saída
// inteira ("response did not match schema") e nada era salvo. Arrays com
// .default([]) mantêm a UI segura mesmo quando o modelo omite um campo.
const AnaliseSchema = z.object({
  resumo_operacional: z.string().describe("Resumo denso em até 6 linhas, em PT-BR"),
  interlocutores: z.array(InterlocutorSchema).max(20).default([]),
  temas: z.array(z.string()).max(20).default([]),
  decisoes: z
    .array(z.string())
    .max(20)
    .default([])
    .describe("Decisões DETECTADAS, não confirmadas"),
  sinais: z
    .array(z.string())
    .max(20)
    .default([])
    .describe("Sinais relevantes — emocionais, jurídicos, contextuais"),
  proximos_gestos: z
    .array(z.string())
    .max(20)
    .default([])
    .describe("Ações sugeridas pela conversa, não imperativos"),
  candidatos_revisao: z
    .array(z.string())
    .max(20)
    .default([])
    .describe("Trechos densos que merecem virar HIPÓTESE de memória, jamais memória direta"),
});

export type CamaraAnalise = z.infer<typeof AnaliseSchema> & {
  ata_markdown?: string;
  infografico_svg?: string;
};

// ────────────────────────────────────────────────────────────────────
// Fase 1: CRUD de sessões e segmentos (motor consolidado)
// ────────────────────────────────────────────────────────────────────

export type CamaraSessao = {
  id: string;
  titulo: string;
  modo: "audio" | "texto";
  status: "gravando" | "finalizado";
  texto_rapido: string | null;
  analise: CamaraAnalise | null;
  analise_at: string | null;
  created_at: string;
};

export type CamaraSegmento = {
  id: string;
  sessao_id: string;
  ordem: number;
  inicio_seg: number;
  fim_seg: number;
  audio_path: string | null;
  transcricao: string | null;
  status: "queued" | "processing" | "transcribed" | "failed";
  erro: string | null;
};

export const listarSessoesCamara = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("camara_sessoes")
      .select("id, titulo, modo, status, texto_rapido, analise, analise_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CamaraSessao[];
  });

const CriarSessaoInput = z.object({
  titulo: z.string().trim().min(1).max(160),
  modo: z.enum(["audio", "texto"]),
  texto_rapido: z.string().trim().min(1).max(60000).optional(),
});

export const criarSessaoCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarSessaoInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.modo === "texto" && !data.texto_rapido) {
      throw new Error("Conteúdo obrigatório para câmara rápida em texto");
    }
    const { data: row, error } = await context.supabase
      .from("camara_sessoes")
      .insert({
        user_id: context.userId,
        titulo: data.titulo,
        modo: data.modo,
        status: data.modo === "texto" ? "finalizado" : "gravando",
        texto_rapido: data.modo === "texto" ? data.texto_rapido : null,
      })
      .select("id, titulo, modo, status, texto_rapido, analise, analise_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as CamaraSessao;
  });

const SessaoIdInput = z.object({ sessao_id: z.string().uuid() });

export const finalizarSessaoCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessaoIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("camara_sessoes")
      .update({ status: "finalizado" })
      .eq("id", data.sessao_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletarSessaoCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessaoIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: segs } = await context.supabase
      .from("camara_segmentos")
      .select("audio_path")
      .eq("sessao_id", data.sessao_id)
      .eq("user_id", context.userId);
    const paths = (segs ?? []).map((s) => s.audio_path).filter((p): p is string => !!p);
    if (paths.length) {
      await context.supabase.storage.from("camara-audio").remove(paths);
    }
    const { error } = await context.supabase
      .from("camara_sessoes")
      .delete()
      .eq("id", data.sessao_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarSegmentosCamara = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessaoIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: segs, error } = await context.supabase
      .from("camara_segmentos")
      .select("id, sessao_id, ordem, inicio_seg, fim_seg, audio_path, transcricao, status, erro")
      .eq("sessao_id", data.sessao_id)
      .eq("user_id", context.userId)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (segs ?? []) as CamaraSegmento[];
  });

const CriarSegmentoInput = z.object({
  sessao_id: z.string().uuid(),
  ordem: z.number().int().positive(),
  inicio_seg: z.number().int().nonnegative(),
  fim_seg: z.number().int().nonnegative(),
});

export const criarSegmentoCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarSegmentoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: sessao } = await context.supabase
      .from("camara_sessoes")
      .select("id")
      .eq("id", data.sessao_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sessao) throw new Error("Câmara não encontrada");

    const { data: row, error } = await context.supabase
      .from("camara_segmentos")
      .insert({
        user_id: context.userId,
        sessao_id: data.sessao_id,
        ordem: data.ordem,
        inicio_seg: data.inicio_seg,
        fim_seg: data.fim_seg,
        status: "queued",
      })
      .select("id, sessao_id, ordem, inicio_seg, fim_seg, audio_path, transcricao, status, erro")
      .single();
    if (error) throw new Error(error.message);
    return row as CamaraSegmento;
  });

const ConfirmarAudioPathInput = z.object({
  segmento_id: z.string().uuid(),
  audio_path: z.string().trim().min(1),
});

export const confirmarAudioPathCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmarAudioPathInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("camara_segmentos")
      .update({ audio_path: data.audio_path })
      .eq("id", data.segmento_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ANALISE_SYSTEM = `Você é a Kaline em modo Câmara de Eco — escuta, segmenta e devolve sentido sem tomar posse da conversa.

REGRAS INVIOLÁVEIS:
- Não invente interlocutores. Se não houver evidência clara, descreva funcionalmente.
- Não afirme identidade sem lastro: prefira "provável", "possível", "hipotético".
- Não transforme hipótese em fato.
- Não transforme transcrição em memória final.
- Não envie nada direto para o Jardim — sua análise é DENSIDADE PROCESSADA, não verdade confirmada.
- Decisão detectada ≠ compromisso sedimentado. Próximo gesto ≠ tarefa atribuída.
- Use português brasileiro, tom seco e respeitoso, sem floreios.

Devolva apenas JSON conforme o schema solicitado.`;

const ATA_SYSTEM = `Você é a Kaline em modo Câmara de Eco. Gere uma ATA ESTRUTURADA da reunião em Markdown (PT-BR), pronta para compartilhar.

REGRAS INVIOLÁVEIS:
- Não invente interlocutores nem fatos. Se não houver evidência clara, descreva funcionalmente ("uma participante", "o apresentador").
- Marque incertezas como "provável/possível/hipótese". Hipótese não vira fato.
- Tom seco e respeitoso, sem floreios. Fidelidade à transcrição acima de tudo.

FORMATO (use apenas as seções que fizerem sentido, nesta ordem):
1. **Tema central** e objetivo
2. **Contexto**
3. **Tópicos discutidos** (subtópicos com bullets)
4. **Decisões e encaminhamentos** — em TABELA Markdown (colunas: Tema | Encaminhamento)
5. **Pontos de atenção**
6. **Próximos passos / tarefas**
7. **Síntese final**

Devolva apenas o Markdown da ata, sem cercas de código (\`\`\`) externas e sem comentários fora da ata.`;

const INFOGRAFICO_SYSTEM = `Você gera um INFOGRÁFICO da reunião como UM ÚNICO elemento SVG autocontido, pronto para exibir e exportar.

REGRAS TÉCNICAS (obrigatórias):
- Devolva SOMENTE o markup do SVG, começando em "<svg" e terminando em "</svg>". Nada antes ou depois, sem cercas de código.
- Use exatamente: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" font-family="Arial, Helvetica, sans-serif">. width/height podem ser omitidos.
- Use APENAS estilos inline e fontes genéricas (sans-serif). NÃO use <script>, <foreignObject>, <image>, <iframe>, eventos on*, nem qualquer recurso/URL externo.
- Texto via <text>/<tspan>. NÃO há wrapping automático: quebre linhas manualmente e nunca passe de ~46 caracteres por linha. Trunque com "…" o que não couber.

SISTEMA VISUAL (siga à risca):
- Fundo: <rect x="0" y="0" width="1200" height="1600" fill="#15151f"/>.
- Paleta: texto principal #f3f1ea; texto secundário #b8b4a8; destaque/ouro #d4af37; cartões #20202e com stroke #d4af37 (stroke-width="1.5", rx="16").
- Margem lateral segura: conteúdo entre x=64 e x=1136 (largura útil 1072).
- Tamanhos de fonte: título do topo 44 (font-weight="700", fill #f3f1ea); subtítulo/duração 22 (#b8b4a8); rótulo de seção 26 (font-weight="700", #d4af37); corpo 22 (#f3f1ea); número grande dos contadores 56 (font-weight="700", #d4af37); legenda do contador 18 (#b8b4a8).
- Espaçamento: ~28px entre linhas de corpo; ~48px entre blocos; padding interno dos cartões 24px.
- Estrutura vertical, nesta ordem: (1) cabeçalho com título + duração; (2) faixa de 3 contadores (nº de temas, decisões, próximos gestos) como cartões lado a lado; (3) seção "Temas" — até 5 itens em bullets; (4) seção "Decisões" — até 5 itens; (5) seção "Próximos gestos" — até 4 itens; (6) rodapé discreto "Câmara de Eco" 16 (#b8b4a8) centralizado perto de y=1560.

CONTEÚDO:
- Baseie-se ESTRITAMENTE nos dados estruturados fornecidos (título, resumo, interlocutores, temas, decisões, sinais, próximos gestos, duração). Não invente números nem itens. Se uma lista vier vazia, omita a seção (não invente).`;

const AnalisarInput = z.object({ sessao_id: z.string().uuid() });

export const analisarCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalisarInput.parse(d))
  .handler(async ({ data, context }) => {
    // Imports server-only dinâmicos: este módulo é referenciado por rotas de
    // cliente via RPC, então import estático de `*.server.*` quebra o build.
    const { createOpenRouterProvider } = await import("@/lib/openrouter.server");
    const { AI_MODELS } = await import("@/lib/ai-models.server");
    let gateway: ReturnType<typeof createOpenRouterProvider>;
    try {
      gateway = createOpenRouterProvider();
    } catch (err) {
      console.error("AI provider configuration error", err instanceof Error ? err.message : err);
      throw new Error("A IA ainda não está configurada neste ambiente.");
    }

    const { data: sessao, error: sessaoErr } = await context.supabase
      .from("camara_sessoes")
      .select("id, user_id, titulo, modo, texto_rapido")
      .eq("id", data.sessao_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (sessaoErr || !sessao) throw new Error("Câmara não encontrada");
    if (sessao.user_id !== context.userId) throw new Error("Forbidden");

    let conteudo = "";
    if (sessao.modo === "texto") {
      conteudo = sessao.texto_rapido ?? "";
    } else {
      const { data: segs } = await context.supabase
        .from("camara_segmentos")
        .select("ordem, inicio_seg, fim_seg, transcricao")
        .eq("sessao_id", sessao.id)
        .eq("user_id", context.userId)
        .order("ordem", { ascending: true });
      conteudo = (segs ?? [])
        .filter((s) => s.transcricao)
        .map((s) => {
          const fmt = (n: number) =>
            `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
          return `[Bloco ${String(s.ordem).padStart(2, "0")} | ${fmt(s.inicio_seg)}–${fmt(s.fim_seg)}]\n${s.transcricao}`;
        })
        .join("\n\n");
    }

    if (!conteudo.trim() || conteudo.trim().length < 30) {
      throw new Error("Conteúdo insuficiente para análise (mínimo ~30 caracteres transcritos).");
    }

    const conteudoLimitado = conteudo.slice(0, 60000);
    const promptBase = `Câmara: "${sessao.titulo}"\n\nConteúdo registrado:\n\n${conteudoLimitado}`;

    // ── Pass 1: análise estruturada (com fallback para texto) ──────────
    // Se o modelo não conseguir produzir o JSON conforme o schema, não
    // perdemos tudo: caímos para um resumo denso em texto e seguimos.
    let estruturado: z.infer<typeof AnaliseSchema>;
    try {
      const { experimental_output } = await generateText({
        model: gateway(AI_MODELS.reasoning),
        system: ANALISE_SYSTEM,
        prompt: promptBase,
        experimental_output: Output.object({ schema: AnaliseSchema }),
        temperature: 0.3,
        maxOutputTokens: 4000,
      });
      estruturado = experimental_output;
    } catch (err) {
      console.warn(
        "Câmara: análise estruturada falhou, usando fallback em texto",
        err instanceof Error ? err.message : err,
      );
      const { text } = await generateText({
        model: gateway(AI_MODELS.reasoning),
        system: ANALISE_SYSTEM,
        prompt: `${promptBase}\n\nNÃO foi possível estruturar em JSON. Devolva apenas um resumo operacional denso em PT-BR (até 8 linhas), tom seco, fiel à transcrição.`,
        maxOutputTokens: 1200,
      });
      estruturado = {
        resumo_operacional: text.trim() || "Não foi possível gerar a análise estruturada.",
        interlocutores: [],
        temas: [],
        decisoes: [],
        sinais: [],
        proximos_gestos: [],
        candidatos_revisao: [],
      };
    }

    // ── Pass 2: ata estruturada em Markdown (não bloqueia o salvamento) ──
    let ata_markdown: string | undefined;
    try {
      const { text } = await generateText({
        model: gateway(AI_MODELS.reasoning),
        system: ATA_SYSTEM,
        prompt: promptBase,
        temperature: 0.4,
        maxOutputTokens: 6000,
      });
      const limpa = text
        .trim()
        .replace(/^```(?:markdown|md)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "");
      if (limpa) ata_markdown = limpa;
    } catch (err) {
      console.warn("Câmara: ata falhou", err instanceof Error ? err.message : err);
    }

    // ── Pass 3: infográfico SVG, grounded nos dados (não bloqueia) ──────
    let infografico_svg: string | undefined;
    try {
      const dadosBase = {
        titulo: sessao.titulo,
        resumo_operacional: estruturado.resumo_operacional,
        interlocutores: estruturado.interlocutores,
        temas: estruturado.temas,
        decisoes: estruturado.decisoes,
        sinais: estruturado.sinais,
        proximos_gestos: estruturado.proximos_gestos,
      };
      const { text } = await generateText({
        model: gateway(AI_MODELS.reasoning),
        system: INFOGRAFICO_SYSTEM,
        prompt: `Dados estruturados da reunião (use EXATAMENTE estes valores):\n\n${JSON.stringify(dadosBase, null, 2)}`,
        temperature: 0.2,
        maxOutputTokens: 8000,
      });
      infografico_svg = sanitizeSvg(text);
    } catch (err) {
      console.warn("Câmara: infográfico falhou", err instanceof Error ? err.message : err);
    }

    const analise: CamaraAnalise = { ...estruturado, ata_markdown, infografico_svg };

    const { error: upErr } = await context.supabase
      .from("camara_sessoes")
      .update({ analise, analise_at: new Date().toISOString() })
      .eq("id", sessao.id)
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);

    return analise;
  });

// Extrai o <svg>…</svg> e remove vetores de XSS (scripts, handlers e
// foreignObject) antes de persistir. Mesmo assim a UI o exibe via <img>
// data-URL, onde scripts não executam — defesa em profundidade.
function sanitizeSvg(raw: string): string | undefined {
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return undefined;
  let svg = match[0];
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  svg = svg.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  svg = svg.replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
  return svg.trim();
}

// ────────────────────────────────────────────────────────────────────
// Fase 3: ações revisáveis (sempre com confirmação visual no cliente)
// ────────────────────────────────────────────────────────────────────

const SemearInput = z.object({
  sessao_id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(8000),
  origem: z.enum(["decisao", "proximo_gesto", "sinal", "candidato_revisao", "tema", "manual"]),
});

// Semeia uma HIPÓTESE no Jardim/Revisão.
// Marcada com tags ['hipotese','curto_prazo'] e importance=1 para sinalizar
// que ainda não é memória sedimentada — aparece já na Revisão de hoje.
export const semearHipoteseCamara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SemearInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: sessao } = await context.supabase
      .from("camara_sessoes")
      .select("id,user_id")
      .eq("id", data.sessao_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sessao || sessao.user_id !== context.userId) throw new Error("Forbidden");

    const { data: row, error } = await context.supabase
      .from("jardim_memorias")
      .insert({
        user_id: context.userId,
        title: data.title,
        body: data.body,
        source: "camara-de-eco",
        source_ref: data.sessao_id,
        category: "hipotese",
        tags: ["hipotese", "curto_prazo", `camara:${data.origem}`],
        importance: 1,
        next_review_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const KairosInput = z.object({
  sessao_id: z.string().uuid(),
  titulo: z.string().trim().min(1).max(160),
  descricao: z.string().trim().max(2000).optional(),
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }).optional(),
  tipo: z
    .enum(["compromisso", "prazo", "reuniao", "evento", "aula", "outro"])
    .default("compromisso"),
});

// Cria um retorno Kairós — algo para "trazer para hoje" ou "adormecer para depois".
export const criarRetornoKairos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KairosInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: sessao } = await context.supabase
      .from("camara_sessoes")
      .select("id,user_id,titulo")
      .eq("id", data.sessao_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sessao || sessao.user_id !== context.userId) throw new Error("Forbidden");

    const descricaoFinal = [data.descricao ?? "", `\n— retorno da Câmara: "${sessao.titulo}"`].join(
      "",
    );

    const { data: row, error } = await context.supabase
      .from("eventos")
      .insert({
        user_id: context.userId,
        titulo: data.titulo,
        descricao: descricaoFinal.trim(),
        tipo: data.tipo,
        inicio: data.inicio,
        fim: data.fim ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
