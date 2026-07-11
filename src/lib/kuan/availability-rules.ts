export interface OverrideRule {
  label?: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  days: number[];
  startTime: string | null;
  endTime: string | null;
  notes?: string;
}

export interface CanonicalRules {
  days: number[]; // 0 Sunday, ..., 6 Saturday
  startTime: string | null; // "HH:mm"
  endTime: string | null; // "HH:mm"
  defaultDurationMinutes: number;
  minimumNoticeHours: number;
  blockConfirmedConflicts: boolean;
  unavailableMessage: string;
  notes: string | null;
  overrides?: OverrideRule[];
}

const DEFAULT_UNAVAILABLE_MESSAGE =
  "Esse horário está fora das regras de atendimento do Guardião. Escolha outro horário ou envie uma observação.";

/**
 * Normaliza qualquer formato do campo regras_agenda (null, string legado, objeto novo ou legado)
 * para a estrutura CanonicalRules segura e unificada.
 */
export function normalizeAvailabilityRules(value: unknown): CanonicalRules {
  const rules: CanonicalRules = {
    days: [],
    startTime: null,
    endTime: null,
    defaultDurationMinutes: 60,
    minimumNoticeHours: 0,
    blockConfirmedConflicts: true,
    unavailableMessage: DEFAULT_UNAVAILABLE_MESSAGE,
    notes: null,
    overrides: [],
  };

  if (!value) return rules;

  let obj: Record<string, unknown> = {};
  let rawOverrides: any[] | null = null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.default) {
          obj = parsed.default;
          rawOverrides = parsed.overrides || null;
        } else {
          obj = parsed;
        }
      } catch {
        obj = parseTextLinesToRecord(trimmed);
      }
    } else {
      obj = parseTextLinesToRecord(trimmed);
    }
  } else if (Array.isArray(value)) {
    obj = { dias_atendimento: value };
  } else if (typeof value === "object" && value !== null) {
    const parsed = value as Record<string, any>;
    if (parsed.default) {
      obj = parsed.default;
      rawOverrides = parsed.overrides || null;
    } else {
      obj = parsed;
    }
  }

  // Normalizar Dias de Atendimento
  const rawDays = obj.dias_atendimento ?? obj.dias ?? obj.days ?? obj.daysOfWeek;
  if (rawDays !== undefined) {
    if (Array.isArray(rawDays)) {
      const parsedDays: number[] = [];
      for (const d of rawDays) {
        const p = parseDayNameOrNumber(d);
        if (p !== null && !parsedDays.includes(p)) parsedDays.push(p);
      }
      rules.days = parsedDays.sort((a, b) => a - b);
    } else if (typeof rawDays === "string") {
      const s = rawDays
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (s.includes("seg-sex") || s.includes("segunda a sexta")) {
        rules.days = [1, 2, 3, 4, 5];
      } else if (s.includes("seg-sab") || s.includes("segunda a sabado")) {
        rules.days = [1, 2, 3, 4, 5, 6];
      } else if (
        s.includes("seg-dom") ||
        s.includes("segunda a domingo") ||
        s.includes("todos os dias") ||
        s.includes("diariamente")
      ) {
        rules.days = [0, 1, 2, 3, 4, 5, 6];
      } else {
        const parts = s.split(/[\s,]+/);
        const parsedDays: number[] = [];
        for (const part of parts) {
          const p = parseDayNameOrNumber(part);
          if (p !== null && !parsedDays.includes(p)) parsedDays.push(p);
        }
        rules.days = parsedDays.sort((a, b) => a - b);
      }
    }
  }

  // Normalizar Horário de Entrada / Saída
  const rawStart =
    obj.hora_inicio ?? obj.horario_inicio ?? obj.hora_abertura ?? obj.startTime ?? obj.start;
  if (typeof rawStart === "string") {
    rules.startTime = parseTimeString(rawStart);
  }
  const rawEnd = obj.hora_fim ?? obj.horario_fim ?? obj.hora_fechamento ?? obj.endTime ?? obj.end;
  if (typeof rawEnd === "string") {
    rules.endTime = parseTimeString(rawEnd);
  }

  // Normalizar Duração Padrão
  const rawDuration = obj.duracao_padrao_minutos ?? obj.duracao ?? obj.defaultDurationMinutes;
  if (rawDuration !== undefined) {
    const num = Number(rawDuration);
    if (!isNaN(num) && num > 0) rules.defaultDurationMinutes = num;
  }

  // Normalizar Antecedência Mínima
  const rawNotice = obj.antecedencia_minima_horas ?? obj.antecedencia ?? obj.minimumNoticeHours;
  if (rawNotice !== undefined) {
    const num = Number(rawNotice);
    if (!isNaN(num) && num >= 0) rules.minimumNoticeHours = num;
  }

  // Normalizar Bloqueio de Conflito Confirmado
  const rawConflict =
    obj.bloquear_conflito_confirmado ?? obj.bloquear_conflitos ?? obj.blockConfirmedConflicts;
  if (rawConflict !== undefined) {
    rules.blockConfirmedConflicts =
      rawConflict === true ||
      String(rawConflict).trim().toLowerCase() === "true" ||
      rawConflict === 1 ||
      rawConflict === "1";
  }

  // Normalizar Mensagem de Indisponibilidade
  const rawMessage = obj.mensagem_indisponivel ?? obj.mensagem ?? obj.unavailableMessage;
  if (typeof rawMessage === "string" && rawMessage.trim()) {
    rules.unavailableMessage = rawMessage.trim();
  }

  // Normalizar Observações
  const rawNotes = obj.observacoes ?? obj.notes;
  if (typeof rawNotes === "string" && rawNotes.trim()) {
    rules.notes = rawNotes.trim();
  }

  if (rawOverrides && Array.isArray(rawOverrides)) {
    rules.overrides = rawOverrides.map((ov: any) => ({
      label: ov.label ?? undefined,
      startDate: String(ov.startDate || ""),
      endDate: String(ov.endDate || ""),
      days: Array.isArray(ov.days) ? ov.days.map((d: any) => Number(d)) : [],
      startTime: typeof ov.startTime === "string" ? parseTimeString(ov.startTime) : null,
      endTime: typeof ov.endTime === "string" ? parseTimeString(ov.endTime) : null,
      notes: ov.notes ?? undefined,
    }));
  }

  return rules;
}

function parseDayNameOrNumber(val: unknown): number | null {
  if (typeof val === "number") {
    if (val >= 0 && val <= 6) return val;
    return null;
  }
  if (typeof val !== "string" && typeof val !== "number") return null;

  const s = String(val)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (s === "0" || s === "domingo" || s === "dom" || s === "sunday" || s === "sun") return 0;
  if (
    s === "1" ||
    s === "segunda" ||
    s === "segunda-feira" ||
    s === "seg" ||
    s === "monday" ||
    s === "mon"
  )
    return 1;
  if (
    s === "2" ||
    s === "terca" ||
    s === "terca-feira" ||
    s === "ter" ||
    s === "tuesday" ||
    s === "tue"
  )
    return 2;
  if (
    s === "3" ||
    s === "quarta" ||
    s === "quarta-feira" ||
    s === "qua" ||
    s === "wednesday" ||
    s === "wed"
  )
    return 3;
  if (
    s === "4" ||
    s === "quinta" ||
    s === "quinta-feira" ||
    s === "qui" ||
    s === "thursday" ||
    s === "thu"
  )
    return 4;
  if (
    s === "5" ||
    s === "sexta" ||
    s === "sexta-feira" ||
    s === "sex" ||
    s === "friday" ||
    s === "fri"
  )
    return 5;
  if (s === "6" || s === "sabado" || s === "sab" || s === "saturday" || s === "sat") return 6;

  return null;
}

function parseTimeString(val: string): string | null {
  const match = val.trim().match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const h = match[1].padStart(2, "0");
    const m = match[2];
    return `${h}:${m}`;
  }
  return null;
}

function parseTextLinesToRecord(text: string): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      let v: any = line.slice(idx + 1).trim();
      if (v.toLowerCase() === "true") v = true;
      else if (v.toLowerCase() === "false") v = false;
      else if (!isNaN(Number(v))) v = Number(v);
      record[k] = v;
    }
  }
  return record;
}

/**
 * Procura um override aplicável para uma determinada data e, se encontrar, retorna-o.
 * Caso contrário, retorna as regras padrão de dias e horários.
 */
export function getApplicableRule(
  date: Date,
  rules: CanonicalRules,
): { days: number[]; startTime: string | null; endTime: string | null } {
  if (rules.overrides && Array.isArray(rules.overrides)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    const ymd = `${year}-${month}-${dayStr}`;

    for (const ov of rules.overrides) {
      if (ov.startDate && ov.endDate) {
        if (ymd >= ov.startDate && ymd <= ov.endDate) {
          return {
            days: ov.days ?? [],
            startTime: ov.startTime ?? null,
            endTime: ov.endTime ?? null,
          };
        }
      }
    }
  }

  return {
    days: rules.days,
    startTime: rules.startTime,
    endTime: rules.endTime,
  };
}

/**
 * Valida se a data e o horário estão dentro das regras de dias e janelas de atendimento.
 */
export function isWithinAvailabilityRules(date: Date, rules: CanonicalRules): boolean {
  const activeRule = getApplicableRule(date, rules);

  // Se houver dias configurados na regra ativa, validar se o dia bate
  if (activeRule.days && activeRule.days.length > 0) {
    const day = date.getDay(); // 0-6
    if (!activeRule.days.includes(day)) {
      return false;
    }
  } else {
    // Se o override foi definido, mas a lista de dias é vazia, significa que não atende nenhum dia!
    const isOverride =
      rules.overrides &&
      rules.overrides.some((ov) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const dayStr = String(date.getDate()).padStart(2, "0");
        const ymd = `${year}-${month}-${dayStr}`;
        return ov.startDate && ov.endDate && ymd >= ov.startDate && ymd <= ov.endDate;
      });
    if (isOverride) {
      return false;
    }
  }

  // Se houver horários configurados na regra ativa, validar se a hora bate
  if (activeRule.startTime && activeRule.endTime) {
    const [startH, startM] = activeRule.startTime.split(":").map(Number);
    const [endH, endM] = activeRule.endTime.split(":").map(Number);

    const hour = date.getHours();
    const minute = date.getMinutes();

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const currentTotal = hour * 60 + minute;

    if (currentTotal < startTotal || currentTotal > endTotal) {
      return false;
    }
  }

  return true;
}

/**
 * Valida se a data escolhida já passou ou não respeita a antecedência mínima em horas.
 */
export function isPastOrTooSoon(
  date: Date,
  rules: CanonicalRules,
  now: Date = new Date(),
): boolean {
  if (date.getTime() <= now.getTime()) {
    return true; // Passado
  }

  if (rules.minimumNoticeHours > 0) {
    const noticeMs = rules.minimumNoticeHours * 60 * 60 * 1000;
    if (date.getTime() < now.getTime() + noticeMs) {
      return true; // Violou antecedência mínima
    }
  }

  return false;
}

/**
 * Formata um resumo curto e elegante das regras de atendimento para exibição pública.
 */
export function formatAvailabilitySummary(rules: CanonicalRules): string {
  const hasDays = rules.days && rules.days.length > 0;
  const hasTime = rules.startTime && rules.endTime;

  if (!hasDays && !hasTime) {
    return "Regras de agenda ainda não publicadas. Envie uma preferência de horário para o Guardião avaliar.";
  }

  let daysText = "";
  if (hasDays) {
    const isSegSex =
      rules.days.length === 5 && [1, 2, 3, 4, 5].every((d) => rules.days.includes(d));
    const isSegSab =
      rules.days.length === 6 && [1, 2, 3, 4, 5, 6].every((d) => rules.days.includes(d));
    const isTodos = rules.days.length === 7;

    if (isTodos) {
      daysText = "todos os dias";
    } else if (isSegSex) {
      daysText = "segunda a sexta";
    } else if (isSegSab) {
      daysText = "segunda a sábado";
    } else {
      const ptDays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
      daysText = rules.days.map((d) => ptDays[d]).join(", ");
    }
  } else {
    daysText = "todos os dias";
  }

  let timeText = "";
  if (hasTime) {
    timeText = `, das ${rules.startTime} às ${rules.endTime}`;
  }

  let noticeText = "";
  if (rules.minimumNoticeHours > 0) {
    noticeText = `. Solicite com pelo menos ${rules.minimumNoticeHours}h de antecedência`;
  }

  return `Atendimento de ${daysText}${timeText}${noticeText}.`;
}

/**
 * Retorna as frases de copywriting exatas e seguras exigidas pelas especificações.
 */
export function getAvailabilityViolationMessage(reason: string, rules: CanonicalRules): string {
  switch (reason) {
    case "past":
      return "Esse horário já passou. Escolha uma data futura.";
    case "too_soon":
      return "Esse horário está muito próximo. Escolha outro horário respeitando a antecedência mínima do Guardião.";
    case "outside_day":
    case "outside_hours":
    case "outside_availability":
      return rules.unavailableMessage || DEFAULT_UNAVAILABLE_MESSAGE;
    case "conflict_confirmed":
      return "Esse horário já tem compromisso confirmado. Escolha outro horário ou envie uma observação.";
    case "invalid_datetime":
      return "O formato da data ou horário é inválido. Escolha um horário válido.";
    default:
      return "Horário indisponível para agendamento.";
  }
}
