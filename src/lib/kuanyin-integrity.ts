// Camada de integridade comercial da Kuan-Yin.
// Classifica respostas do assistente contra os invariantes inegociáveis
// e registra alertas em `kuanyin_integrity_logs`. Não bloqueia a resposta
// (não é censor): é trilha de auditoria + sinal para o guardião revisar.
//
// Regras → severidade:
//   warn  → frases que comprometem invariante mas não bloqueiam fluxo
//   block → afirmação direta proibida (ex.: "pagamento confirmado pelo comprovante")
//
// Heurística leve, pt-BR. Mantém custo zero e dependências mínimas.

export type IntegritySignal = {
  category: string;
  severity: "info" | "warn" | "block";
  note: string;
  excerpt: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

type Rule = {
  category: string;
  severity: "warn" | "block";
  note: string;
  any: RegExp[];
  // se "near" estiver presente, precisa coexistir
  near?: RegExp[];
};

const RULES: Rule[] = [
  {
    category: "pagamento_confirmado_por_comprovante",
    severity: "block",
    note: "Resposta tratou comprovante como pagamento confirmado. Invariante 1: comprovante NUNCA confirma.",
    any: [
      /\b(pagamento|valor|fatura)\s+(confirmado|recebido|quitado|aprovado|baixado)\b/,
      /\bpago\s+(via|por)\s+(pix|comprovante|transferencia|ted|deposito)\b/,
      /\brecebi\s+o\s+pagamento\b/,
      /\bpagamento\s+ok\b/,
    ],
  },
  {
    category: "agendamento_confirmado_por_iniciativa",
    severity: "warn",
    note: "Resposta afirmou agendamento confirmado sem cartão de proposta + confirmação humana.",
    any: [
      /\bagendamento\s+(confirmado|marcado|garantido|reservado)\b/,
      /\bhorario\s+reservado\b/,
      /\bja\s+(marquei|agendei|reservei)\b/,
    ],
  },
  {
    category: "promessa_de_resultado",
    severity: "warn",
    note: "Resposta promete resultado garantido. Invariante 8.",
    any: [
      /\b(garantia|garanto|garantido)\s+(de\s+)?(cura|sucesso|resultado|retorno|emagrecimento|aprovacao)\b/,
      /\b100%\s+(garantido|eficaz|seguro|de\s+sucesso)\b/,
      /\bsempre\s+funciona\b/,
    ],
  },
  {
    category: "urgencia_falsa",
    severity: "warn",
    note: "Resposta usa urgência/escassez forjada (dark pattern). Invariante 7.",
    any: [
      /\bultim[ao]s?\s+vaga[s]?\b/,
      /\bso\s+hoje\b/,
      /\boferta\s+relampago\b/,
      /\bcorre\s+que\s+vai\s+acabar\b/,
      /\bnao\s+perca\s+essa\s+chance\b/,
    ],
  },
  {
    category: "decisao_por_atributo_protegido",
    severity: "block",
    note: "Resposta condiciona atendimento/preço a atributo protegido. Invariante 6.",
    any: [
      /\b(so|apenas|exclusivo)\s+(para|p\/)\s+(homens|mulheres|brancos|negros|cristaos|catolicos|evangelicos|jovens|idosos)\b/,
      /\bnao\s+(atendo|atendemos)\s+(homem|mulher|negro|branco|gay|trans|estrangeiro)/,
    ],
  },
  {
    category: "vazamento_de_prompt",
    severity: "block",
    note: "Resposta tentou revelar prompt/identidade técnica/secret. Invariante 4.",
    any: [
      /\bmeu\s+system\s+prompt\b/,
      /\bservice_role\b/,
      /\bsupabase[_\s-]?(url|service_role|publishable)\b/,
      /\bgemini|openai|anthropic|openrouter_api_key\b/,
    ],
    near: [/\b(sou|uso|rodo|baseado em|provedor|modelo)\b/],
  },
];

export function classifyKuanyinResponse(text: string): IntegritySignal[] {
  if (!text || text.length < 8) return [];
  const t = norm(text);
  const signals: IntegritySignal[] = [];
  for (const rule of RULES) {
    const hit = rule.any.find((re) => re.test(t));
    if (!hit) continue;
    if (rule.near && !rule.near.some((re) => re.test(t))) continue;
    // pega trecho original ao redor do match (best-effort)
    const idx = text.search(new RegExp(hit.source, "i"));
    const excerpt =
      idx >= 0
        ? text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 120)).trim()
        : text.slice(0, 160);
    signals.push({
      category: rule.category,
      severity: rule.severity,
      note: rule.note,
      excerpt,
    });
  }
  return signals;
}
