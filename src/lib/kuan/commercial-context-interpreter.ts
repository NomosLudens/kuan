export type CommercialAudience =
  | "platform_admin"
  | "guardian_private"
  | "public_client"
  | "unknown";

export type CommercialIntent =
  // For Guardian
  | "guardian_business_profile"
  | "guardian_services_update"
  | "guardian_pricing_update"
  | "guardian_tone_preference"
  | "guardian_availability_rule"
  | "guardian_public_page_request"
  | "guardian_client_policy"
  | "guardian_review_decision"
  | "guardian_business_strategy"
  | "guardian_unknown"
  // For Client
  | "public_service_question"
  | "public_price_question"
  | "public_schedule_question"
  | "public_appointment_request"
  | "public_order_request"
  | "public_payment_proof"
  | "public_contact_request"
  | "public_complaint"
  | "public_out_of_scope"
  | "public_blocked_sensitive"
  | "public_unknown"
  // For Admin
  | "admin_guardian_management"
  | "admin_invite_management"
  | "admin_platform_status"
  | "admin_unknown";

export type ActionBoundary =
  | "answer_only"
  | "suggest_next_step"
  | "propose_draft_update"
  | "ask_confirmation"
  | "route_to_existing_button"
  | "block_and_redirect"
  | "create_pending_request_allowed"
  | "human_review_required";

export interface CommercialContextInterpretation {
  audience: CommercialAudience;
  intent: CommercialIntent;
  boundary: ActionBoundary;
  confidence: number;
  summary: string;
  safeReplyHint: string;
  forbiddenActions: string[];
  suggestedNextStep?: string;
  candidateUpdate?: {
    target:
      | "business_context"
      | "guardian_preferences"
      | "public_page_blueprint"
      | "availability_rules"
      | "none";
    patch: Record<string, unknown>;
    requiresConfirmation: true;
  };
}

export interface InterpretCommercialContextInput {
  audience: CommercialAudience;
  message: string;
  businessName?: string | null;
  hasGuardianScope?: boolean;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function interpretCommercialContext(
  input: InterpretCommercialContextInput,
): CommercialContextInterpretation {
  const norm = normalizeText(input.message);
  const resolvedAudience = input.audience || "unknown";
  const businessName = input.businessName || "o negócio";

  // Default output template
  const result: CommercialContextInterpretation = {
    audience: resolvedAudience,
    intent: "public_unknown",
    boundary: "answer_only",
    confidence: 0.8,
    summary: input.message,
    safeReplyHint: "",
    forbiddenActions: [],
  };

  // 1. PUBLIC CLIENT AUDIENCE
  if (resolvedAudience === "public_client") {
    // Populate public client default forbidden actions
    result.forbiddenActions = [
      "confirm_appointment",
      "confirm_payment",
      "publish_public_page",
      "update_business_context",
    ];

    // Check for blocked/sensitive content first
    const isSexual =
      norm.includes("sexo") ||
      norm.includes("sensual") ||
      norm.includes("final feliz") ||
      norm.includes("gostosa") ||
      norm.includes("gostoso") ||
      norm.includes("nude") ||
      norm.includes("nudez") ||
      norm.includes("foto intima") ||
      norm.includes("fetiche") ||
      norm.includes("massagem sensual") ||
      norm.includes("programa");

    if (isSexual) {
      result.intent = "public_blocked_sensitive";
      result.boundary = "block_and_redirect";
      result.safeReplyHint = `Este atendimento é apenas para assuntos comerciais de ${businessName}: serviços, horários, pedidos, pagamento e orientações do atendimento. Não consigo continuar conversa sexual ou íntima.`;
      result.summary = "Mensagem bloqueada por conter conteúdo sensível ou de teor inadequado.";
      return result;
    }

    // Check for out of scope
    if (
      norm.includes("outro assunto") ||
      norm.includes("outros assuntos") ||
      norm.includes("falar de outra coisa") ||
      norm.includes("outro tema")
    ) {
      result.intent = "public_out_of_scope";
      result.boundary = "block_and_redirect";
      result.safeReplyHint = `Eu só consigo ajudar com assuntos de ${businessName}: serviços, horários, pedidos, pagamento ou atendimento.`;
      result.summary = "Solicitação de diálogo fora do escopo comercial do negócio.";
      return result;
    }

    // Check for payment/proof
    if (
      norm.includes("paguei") ||
      norm.includes("comprovante") ||
      norm.includes("enviei o pix") ||
      norm.includes("pagamento") ||
      norm.includes("transferencia")
    ) {
      result.intent = "public_payment_proof";
      result.boundary = "route_to_existing_button";
      result.safeReplyHint =
        "Comprovante informado não é pagamento confirmado. O Guardião precisa conferir.";
      result.summary = "Cliente enviou ou mencionou o envio de comprovante de pagamento.";
      return result;
    }

    // Check for appointment/scheduling
    if (
      norm.includes("agendar") ||
      norm.includes("agenda") ||
      norm.includes("horario") ||
      norm.includes("marcar") ||
      norm.includes("consulta") ||
      norm.includes("vaga")
    ) {
      result.intent = "public_appointment_request";
      result.boundary = "route_to_existing_button"; // or create_pending_request_allowed
      result.safeReplyHint =
        "Posso registrar isso como solicitação para o Guardião analisar. O horário ainda não fica reservado.";
      result.summary = "Cliente demonstrou interesse em agendar um horário.";
      return result;
    }

    // Check for orders
    if (
      norm.includes("pedido") ||
      norm.includes("orcamento") ||
      norm.includes("pedir") ||
      norm.includes("comprar")
    ) {
      result.intent = "public_order_request";
      result.boundary = "route_to_existing_button";
      result.safeReplyHint = "Posso deixar isso como pedido pendente para o Guardião analisar.";
      result.summary = "Cliente solicitou um orçamento ou a criação de um pedido pendente.";
      return result;
    }

    // Normal questions
    if (norm.includes("servico") || norm.includes("faz") || norm.includes("oferece")) {
      result.intent = "public_service_question";
      result.boundary = "answer_only";
      result.safeReplyHint = `Posso te explicar sobre os serviços de ${businessName}.`;
      return result;
    }

    if (norm.includes("preco") || norm.includes("custa") || norm.includes("valor")) {
      result.intent = "public_price_question";
      result.boundary = "answer_only";
      result.safeReplyHint = `Os preços dos serviços de ${businessName} são definidos pelo Guardião.`;
      return result;
    }

    if (norm.includes("quando") || norm.includes("dia") || norm.includes("disponivel")) {
      result.intent = "public_schedule_question";
      result.boundary = "answer_only";
      result.safeReplyHint = "Posso te informar as regras de disponibilidade gerais.";
      return result;
    }

    // Fallback public_unknown
    result.intent = "public_unknown";
    result.boundary = "answer_only";
    result.safeReplyHint = `Olá! Como posso ajudar com os assuntos de ${businessName}?`;
    return result;
  }

  // 2. PLATFORM ADMIN AUDIENCE
  if (resolvedAudience === "platform_admin") {
    result.intent = "admin_unknown";
    result.boundary = "suggest_next_step";
    result.safeReplyHint =
      "Como gestor da plataforma, você pode consultar relatórios ou convidar novos Guardiões.";

    if (norm.includes("convid") || norm.includes("convite") || norm.includes("invite")) {
      result.intent = "admin_invite_management";
      result.boundary = "suggest_next_step";
      result.summary = "Solicitação de convite ou gerenciamento de acessos de Guardiões.";
      return result;
    }

    if (
      norm.includes("quantos") ||
      norm.includes("guardioes") ||
      norm.includes("plataforma") ||
      norm.includes("status")
    ) {
      result.intent = "admin_platform_status";
      result.boundary = "answer_only";
      result.summary = "Consulta ao status geral da plataforma e contagem de Guardiões.";
      return result;
    }

    return result;
  }

  // 3. GUARDIAN PRIVATE AUDIENCE
  if (resolvedAudience === "guardian_private") {
    result.intent = "guardian_unknown";
    result.boundary = "suggest_next_step";
    result.safeReplyHint =
      "Como Guardião, você pode atualizar suas preferências, serviços e regras de agenda.";

    // a. Tone Preference
    if (
      norm.includes("tom") ||
      norm.includes("gostam de") ||
      norm.includes("informal") ||
      norm.includes("formal") ||
      norm.includes("linguagem") ||
      norm.includes("preferen")
    ) {
      result.intent = "guardian_tone_preference";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização de tom de voz ou preferência de atendimento da Kuan.";

      const toneValue = norm.includes("informal") ? "informal" : "formal";
      result.candidateUpdate = {
        target: "guardian_preferences",
        patch: {
          tone_preference: toneValue,
        },
        requiresConfirmation: true,
      };
      return result;
    }

    // b. Services Update
    if (
      norm.includes("faco") ||
      norm.includes("servico") ||
      norm.includes("massagem") ||
      norm.includes("drenagem") ||
      norm.includes("ofereco")
    ) {
      result.intent = "guardian_services_update";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização de serviços oferecidos no contexto de negócio.";

      // Basic extraction of services from message if helpful
      const extractedServices: string[] = [];
      if (norm.includes("massagem")) extractedServices.push("massagem relaxante");
      if (norm.includes("drenagem")) extractedServices.push("drenagem");

      result.candidateUpdate = {
        target: "business_context",
        patch: {
          servicos: extractedServices.length > 0 ? extractedServices : ["Serviço atualizado"],
        },
        requiresConfirmation: true,
      };
      return result;
    }

    // c. Availability Rule (Recurring / Period Override)
    if (
      norm.includes("atendo") ||
      norm.includes("disponib") ||
      norm.includes("agenda") ||
      norm.includes("quinta") ||
      norm.includes("terca") ||
      norm.includes("quarta") ||
      norm.includes("sexta") ||
      norm.includes("sabado") ||
      norm.includes("domingo") ||
      norm.includes("segunda")
    ) {
      result.intent = "guardian_availability_rule";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização de regras de disponibilidade ou agenda.";

      const isRecurring =
        norm.includes("toda semana") || norm.includes("sempre") || norm.includes("recorrente");
      const kind = isRecurring ? "recurring_default" : "period_override";

      // Detect days
      const daysHint: string[] = [];
      if (norm.includes("segunda")) daysHint.push("segunda");
      if (norm.includes("terca")) daysHint.push("terça");
      if (norm.includes("quarta")) daysHint.push("quarta");
      if (norm.includes("quinta")) daysHint.push("quinta");
      if (norm.includes("sexta")) daysHint.push("sexta");
      if (norm.includes("sabado")) daysHint.push("sábado");
      if (norm.includes("domingo")) daysHint.push("domingo");

      // Extract hours hint (e.g. "9h às 17h", "09:00", etc.)
      let startTimeHint = "09:00";
      let endTimeHint = "17:00";

      const timeMatch =
        norm.match(/das\s+(\d+)(?:h|:00)?\s+as\s+(\d+)(?:h|:00)?/) ||
        norm.match(/das\s+(\d+)(?:h|:00)?\s+ate\s+as\s+(\d+)(?:h|:00)?/);
      if (timeMatch) {
        const start = parseInt(timeMatch[1], 10);
        const end = parseInt(timeMatch[2], 10);
        startTimeHint = `${start.toString().padStart(2, "0")}:00`;
        endTimeHint = `${end.toString().padStart(2, "0")}:00`;
      }

      result.candidateUpdate = {
        target: "availability_rules",
        patch: {
          kind,
          raw_text: input.message,
          days_hint: daysHint.length > 0 ? daysHint : ["terça", "quinta"],
          start_time_hint: startTimeHint,
          end_time_hint: endTimeHint,
          requires_human_confirmation: true,
        },
        requiresConfirmation: true,
      };
      return result;
    }

    // d. Pricing Update
    if (norm.includes("preco") || norm.includes("custa") || norm.includes("valor")) {
      result.intent = "guardian_pricing_update";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização de preços de serviços no contexto de negócio.";
      result.candidateUpdate = {
        target: "business_context",
        patch: {
          precos: { info: input.message },
        },
        requiresConfirmation: true,
      };
      return result;
    }

    // e. Public Page Request (Visual Style)
    if (
      norm.includes("pagina") ||
      norm.includes("visual") ||
      norm.includes("tema") ||
      norm.includes("estilo") ||
      norm.includes("elegante") ||
      norm.includes("escura")
    ) {
      result.intent = "guardian_public_page_request";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização visual ou estilo da página pública do Guardião.";

      let visualStyle = "default";
      if (norm.includes("escura") && norm.includes("elegante")) {
        visualStyle = "elegante e escura";
      } else if (norm.includes("escura")) {
        visualStyle = "escura";
      } else if (norm.includes("elegante")) {
        visualStyle = "elegante";
      }

      result.candidateUpdate = {
        target: "public_page_blueprint",
        patch: {
          visual_style: visualStyle,
        },
        requiresConfirmation: true,
      };
      return result;
    }

    return result;
  }

  // 4. UNKNOWN AUDIENCE FALLBACK
  result.intent = "public_unknown";
  result.boundary = "answer_only";
  return result;
}
