export type RuntimeBoundaryInput = {
  facet?: string | null;
  surface?: string | null;
  mode?: string | null;
  latestUserText?: string | null;
};

export type RuntimeBoundaryDecision =
  | {
      blocked: false;
      runtimeFacet: "kuanyin";
      note?: string;
    }
  | {
      blocked: true;
      targetApp?: "klio-coder";
      reason: "coding_scope" | "personal_kaline_scope" | "out_of_scope";
      message: string;
    };

const CODE_MESSAGE = "Kuan-Yin não escreve código. Esse escopo será atendido em app separado: Klio.";
const PERSONAL_MESSAGE = "Esse pedido pertence à Kaline pessoal, não à Kuan-Yin comercial.";

export function resolveRuntimeBoundary(input: RuntimeBoundaryInput): RuntimeBoundaryDecision {
  const { surface, mode, latestUserText } = input;

  if (surface === "klio" || mode === "pedagogical") {
    return {
      blocked: true,
      targetApp: "klio-coder",
      reason: "out_of_scope",
      message: CODE_MESSAGE,
    };
  }

  if (latestUserText) {
    const lowerText = latestUserText.toLowerCase();
    const codingRegex =
      /\b(código|codar|programar|debug|bug|repo|repositório|pull request|pr|commit|branch|endpoint|migration|migração|schema|supabase|cloudflare worker|api|typescript|javascript|react|vite|build|lint)\b/i;
    if (codingRegex.test(lowerText)) {
      return {
        blocked: true,
        targetApp: "klio-coder",
        reason: "coding_scope",
        message: CODE_MESSAGE,
      };
    }

    const outOfScopeRegex =
      /\b(klio|códice|codice|drive|jurídico|juridico|legislação|legislacao|jurisprudência|jurisprudencia|corpore sano|treino|treinos|diagnóstico clínico|diagnostico clinico)\b/i;
    if (outOfScopeRegex.test(lowerText)) {
      return {
        blocked: true,
        targetApp: "klio-coder",
        reason: "out_of_scope",
        message: CODE_MESSAGE,
      };
    }

    const personalRegex =
      /\b(kaline pessoal|jardim pessoal|facetas|kháris|kharis|vida pessoal|memória pessoal|memoria pessoal|registro vivo pessoal)\b/i;
    if (personalRegex.test(lowerText)) {
      return {
        blocked: true,
        reason: "personal_kaline_scope",
        message: PERSONAL_MESSAGE,
      };
    }
  }

  return {
    blocked: false,
    runtimeFacet: "kuanyin",
  };
}
