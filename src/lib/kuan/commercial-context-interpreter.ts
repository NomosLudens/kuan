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
    summary: "Mensagem do usuário para análise.",
    safeReplyHint: "",
    forbiddenActions: [],
  };

  // 1. PUBLIC CLIENT AUDIENCE
  if (resolvedAudience === "public_client") {
    result.forbiddenActions = [
      "confirm_appointment",
      "confirm_payment",
      "publish_public_page",
      "update_business_context",
    ];

    // Check for blocked/sensitive content first (excluding "programa")
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
      norm.includes("massagem sensual");

    if (isSexual) {
      result.intent = "public_blocked_sensitive";
      result.boundary = "block_and_redirect";
      result.safeReplyHint = `Este atendimento é apenas para assuntos comerciais de ${businessName}: serviços, horários, pedidos, pagamento e orientações do atendimento. Não consigo continuar conversa sexual ou íntima.`;
      result.summary = "Mensagem contendo conteúdo inadequado.";
      return result;
    }

    // Check for out of scope
    if (
      norm.includes("outro assunto") ||
      norm.includes("outros assuntos") ||
      norm.includes("falar de outra coisa") ||
      norm.includes("outro tema") ||
      norm.includes("pizza") ||
      norm.includes("calabresa") ||
      norm.includes("fisica") ||
      norm.includes("quantica") ||
      norm.includes("futebol") ||
      norm.includes("politica")
    ) {
      result.intent = "public_out_of_scope";
      result.boundary = "block_and_redirect";
      result.safeReplyHint = `Eu só consigo ajudar com assuntos de ${businessName}: serviços, horários, pedidos, pagamento ou atendimento.`;
      result.summary = "Solicitação fora do escopo.";
      return result;
    }

    // Check for payment/proof with strict signals
    const isPaymentProof =
      norm.includes("paguei") ||
      norm.includes("comprovante") ||
      norm.includes("enviei o pix") ||
      norm.includes("fiz a transferencia") ||
      norm.includes("segue recibo");

    if (isPaymentProof) {
      result.intent = "public_payment_proof";
      result.boundary = "route_to_existing_button";
      result.safeReplyHint =
        "Comprovante informado não é pagamento confirmado. O Guardião precisa conferir.";
      result.summary = "Envio de comprovante de pagamento.";
      return result;
    }

    // Check for appointment/scheduling with explicit verbs/intents
    const isAppointmentRequest =
      norm.includes("quero agendar") ||
      norm.includes("quero marcar") ||
      norm.includes("tem horario") ||
      norm.includes("gostaria de reservar") ||
      norm.includes("existe vaga") ||
      norm.includes("agendar") ||
      norm.includes("marcar");

    if (isAppointmentRequest) {
      result.intent = "public_appointment_request";
      result.boundary = "route_to_existing_button";
      result.safeReplyHint =
        "Posso registrar isso como solicitação para o Guardião analisar. O horário ainda não fica reservado.";
      result.summary = "Solicitação de agendamento.";
      return result;
    }

    // Check for orders (excluding "pedir" alone)
    const isOrderRequest =
      norm.includes("pedido") ||
      norm.includes("orcamento") ||
      norm.includes("comprar") ||
      norm.includes("fazer um pedido") ||
      norm.includes("pedir orcamento");

    if (isOrderRequest) {
      result.intent = "public_order_request";
      result.boundary = "route_to_existing_button";
      result.safeReplyHint = "Posso deixar isso como pedido pendente para o Guardião analisar.";
      result.summary = "Solicitação de pedido ou orçamento.";
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
    result.safeReplyHint = "Como gestor da plataforma, você pode convidar novos Guardiões.";

    if (norm.includes("convid") || norm.includes("convite") || norm.includes("invite")) {
      result.intent = "admin_invite_management";
      result.boundary = "suggest_next_step";
      result.summary = "Gerenciamento de acessos de Guardiões.";
      return result;
    }

    if (
      norm.includes("quantos") ||
      norm.includes("guardioes") ||
      norm.includes("plataforma") ||
      norm.includes("status")
    ) {
      result.intent = "admin_platform_status";
      result.boundary = "suggest_next_step";
      result.safeReplyHint =
        "Para verificar a contagem de Guardiões e o status detalhado da plataforma, acesse o painel administrativo existente.";
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

    // Order of execution strictly respects priorities and fallback rules.

    // 3.1 Availability Rule (checks days/dates/agenda)
    const isAvailability =
      norm.includes("atendo") ||
      norm.includes("disponib") ||
      norm.includes("agenda") ||
      norm.includes("quinta") ||
      norm.includes("terca") ||
      norm.includes("quarta") ||
      norm.includes("sexta") ||
      norm.includes("sabado") ||
      norm.includes("domingo") ||
      norm.includes("segunda");

    if (isAvailability) {
      result.intent = "guardian_availability_rule";
      result.boundary = "propose_draft_update";
      result.summary = "Solicitação de atualização de regras de disponibilidade.";

      const isRecurring =
        norm.includes("toda semana") || norm.includes("sempre") || norm.includes("recorrente");
      const isPeriod =
        norm.includes("essa semana") ||
        norm.includes("nesta semana") ||
        /\b\d{1,2}\/\d{1,2}\b/.test(norm) ||
        norm.includes("periodo") ||
        norm.includes("ate o dia") ||
        norm.includes("entre o dia") ||
        norm.includes("partir do dia");

      const kind = isRecurring ? "recurring_default" : isPeriod ? "period_override" : "unknown";

      const daysHint: string[] = [];
      if (norm.includes("segunda")) daysHint.push("segunda");
      if (norm.includes("terca")) daysHint.push("terça");
      if (norm.includes("quarta")) daysHint.push("quarta");
      if (norm.includes("quinta")) daysHint.push("quinta");
      if (norm.includes("sexta")) daysHint.push("sexta");
      if (norm.includes("sabado")) daysHint.push("sábado");
      if (norm.includes("domingo")) daysHint.push("domingo");

      let startTimeHint: string | null = null;
      let endTimeHint: string | null = null;

      const timeMatch =
        norm.match(/das\s+(\d+)(?:h|:00)?\s+as\s+(\d+)(?:h|:00)?/) ||
        norm.match(/das\s+(\d+)(?:h|:00)?\s+ate\s+as\s+(\d+)(?:h|:00)?/);
      if (timeMatch) {
        const start = parseInt(timeMatch[1], 10);
        const end = parseInt(timeMatch[2], 10);
        startTimeHint = `${start.toString().padStart(2, "0")}:00`;
        endTimeHint = `${end.toString().padStart(2, "0")}:00`;
      }

      const needsClarification = kind === "unknown" || daysHint.length === 0 || !startTimeHint;

      if (needsClarification) {
        result.boundary = "suggest_next_step";
        result.safeReplyHint =
          "Pode me informar os dias da semana e horários específicos que deseja configurar?";
        result.candidateUpdate = {
          target: "availability_rules",
          patch: {
            kind: "unknown",
            days_hint: [],
            start_time_hint: null,
            end_time_hint: null,
            needs_clarification: true,
          },
          requiresConfirmation: true,
        };
      } else {
        result.candidateUpdate = {
          target: "availability_rules",
          patch: {
            kind,
            days_hint: daysHint,
            start_time_hint: startTimeHint,
            end_time_hint: endTimeHint,
            needs_clarification: false,
          },
          requiresConfirmation: true,
        };
      }
      return result;
    }

    // 3.2 Tone Preference
    const isToneWord =
      norm.includes("tom") ||
      norm.includes("linguagem") ||
      norm.includes("comunicacao") ||
      norm.includes("formal") ||
      norm.includes("informal") ||
      norm.includes("acolhedor") ||
      norm.includes("direto") ||
      norm.includes("tecnico") ||
      norm.includes("casual");

    if (isToneWord) {
      let toneValue: string | null = null;
      if (norm.includes("informal")) toneValue = "informal";
      else if (norm.includes("formal")) toneValue = "formal";
      else if (norm.includes("acolhedor")) toneValue = "acolhedor";
      else if (norm.includes("direto")) toneValue = "direto";
      else if (norm.includes("tecnico")) toneValue = "tecnico";
      else if (norm.includes("casual")) toneValue = "casual";

      if (toneValue) {
        result.intent = "guardian_tone_preference";
        result.boundary = "propose_draft_update";
        result.summary = "Atualização de tom de voz ou preferência de atendimento.";
        result.candidateUpdate = {
          target: "guardian_preferences",
          patch: {
            tone_preference: toneValue,
          },
          requiresConfirmation: true,
        };
      } else {
        result.intent = "guardian_tone_preference";
        result.boundary = "suggest_next_step";
        result.safeReplyHint =
          "Pode esclarecer qual tom de voz ou estilo de comunicação você prefere que a Kuan utilize?";
      }
      return result;
    }

    // 3.3 Services Update
    const isServices =
      norm.includes("faco") ||
      norm.includes("servico") ||
      norm.includes("massagem") ||
      norm.includes("drenagem") ||
      norm.includes("ofereco");

    if (isServices) {
      result.intent = "guardian_services_update";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização de serviços oferecidos.";

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

    // 3.4 Pricing Update
    if (norm.includes("preco") || norm.includes("custa") || norm.includes("valor")) {
      result.intent = "guardian_pricing_update";
      result.boundary = "propose_draft_update";
      result.summary = "Atualização de preços de serviços.";
      result.candidateUpdate = {
        target: "business_context",
        patch: {
          precos: { update_requested: true },
        },
        requiresConfirmation: true,
      };
      return result;
    }

    // 3.5 Public Page Request (Visual Style)
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
      result.summary = "Atualização de estilo da página pública.";

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
