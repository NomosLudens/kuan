export type RuntimeBoundaryInput = {
  facet?: string | null;
  surface?: string | null;
  mode?: string | null;
  latestUserText?: string | null;
};

export type RuntimeBoundaryDecision =
  | {
      blocked: false;
      runtimeFacet: "kaline";
      note?: string;
    }
  | {
      blocked: true;
      targetApp: "klio-coder" | "kuan-yin";
      reason: "coding_scope" | "commercial_scope" | "legacy_klio_scope";
      message: string;
    };

export function resolveRuntimeBoundary(input: RuntimeBoundaryInput): RuntimeBoundaryDecision {
  const { facet, surface, mode, latestUserText } = input;

  // 1. Escopo comercial
  if (facet === "kuanyin" || surface === "kuanyin" || mode === "commercial") {
    return {
      blocked: true,
      targetApp: "kuan-yin",
      reason: "commercial_scope",
      message:
        "Kuan-Yin não está disponível na Kaline Clean. Esse escopo será reconstruído em app separado.",
    };
  }

  // 2. Escopo Klio legado
  if (surface === "klio" || mode === "pedagogical") {
    return {
      blocked: true,
      targetApp: "klio-coder",
      reason: "legacy_klio_scope",
      message:
        "Klio não está disponível na Kaline Clean. Esse escopo será atendido em app separado.",
    };
  }

  // 3. Escopo de programação/código
  // Não bloquear "app" sozinha. Usamos \b para garantir palavras inteiras e evitar falsos positivos
  if (latestUserText) {
    const lowerText = latestUserText.toLowerCase();
    const codingRegex =
      /\b(código|codar|programar|debug|bug|repo|repositório|pull request|pr|commit|branch|endpoint|migration|migração|schema|supabase|cloudflare worker|api|typescript|javascript|react|vite|build|lint)\b/i;

    // Remove isolated "app" matches or ignore them, but the regex doesn't contain "app" anyway,
    // so we just test the text against the regex.
    if (codingRegex.test(lowerText)) {
      return {
        blocked: true,
        targetApp: "klio-coder",
        reason: "coding_scope",
        message:
          "A Kaline Clean não escreve código. Esse escopo será atendido em app separado: Klio.",
      };
    }
  }

  // 4. Kháris
  if (facet === "kharis" || surface === "kharis") {
    return {
      blocked: false,
      runtimeFacet: "kaline",
      note: "Kháris foi incorporada à Kaline como cuidado, presença e orientação simples.",
    };
  }

  // 5. Padrão
  return {
    blocked: false,
    runtimeFacet: "kaline",
  };
}
