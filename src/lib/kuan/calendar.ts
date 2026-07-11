import { CanonicalRules, getApplicableRule } from "./availability-rules";

/**
 * Converte um datetime-local input (ex: "2026-07-20T14:00") e um timezone explícito para um Date UTC.
 * Trata transições de horário de verão e fusos horários corretamente de forma nativa.
 */
export function parseLocalDateTimeInTimeZone(localDateTime: string, timeZone: string): Date {
  if (!localDateTime || typeof localDateTime !== "string") {
    throw new Error("Data e horário inválidos.");
  }

  const match = localDateTime
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error("Formato de data e horário inválido. Use AAAA-MM-DDTHH:mm.");
  }

  // Validar timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
  } catch {
    throw new Error(`Timezone inválido: ${timeZone}`);
  }

  const [_, yearStr, monthStr, dayStr, hourStr, minStr, secStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = secStr ? parseInt(secStr, 10) : 0;

  if (
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw new Error("Horário impossível ou componentes de data inválidos.");
  }

  // Base em UTC presumindo que os campos locais representam UTC
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));

  // Formatar a data UTC presumida no fuso do Guardião para achar a diferença real
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(utcDate);
  const partVal = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

  const fYear = partVal("year");
  const fMonth = partVal("month") - 1;
  const fDay = partVal("day");
  const fHour = partVal("hour");
  const fMinute = partVal("minute");
  const fSecond = partVal("second");

  const formattedLocalDateAsUtc = Date.UTC(fYear, fMonth, fDay, fHour, fMinute, fSecond);
  const offsetMs = formattedLocalDateAsUtc - utcDate.getTime();

  return new Date(utcDate.getTime() - offsetMs);
}

/**
 * Formata um Date em formato de data curta ("DD/MM/AAAA") usando o timezone do Guardião.
 */
export function formatGuardianDate(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Formata um Date em formato completo ("DD/MM/AAAA às HH:mm") usando o timezone do Guardião.
 */
export function formatGuardianDateTime(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", " às");
}

/**
 * Retorna uma string "YYYY-MM-DD" que representa a data local correspondente ao instante no timezone do Guardião.
 */
export function getGuardianDateKey(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Valida se um agendamento com início e duração especificados cabe perfeitamente na janela de atendimento do Guardião,
 * considerando regras de overrides de período e as regras semanais padrão.
 */
export function isAppointmentWithinAvailabilityRules(
  startsAt: Date,
  durationMinutes: number,
  rules: CanonicalRules,
  timeZone: string,
): boolean {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
    return false;
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  // Não permite que o atendimento passe para o dia seguinte no horário local
  const startKey = getGuardianDateKey(startsAt, timeZone);
  const endKey = getGuardianDateKey(endsAt, timeZone);
  if (startKey !== endKey) {
    return false;
  }

  const activeRule = getApplicableRule(startsAt, rules);

  // Validação de dias de atendimento
  if (activeRule.days && activeRule.days.length > 0) {
    // Obter dia da semana local (0-6, onde 0 = Domingo) no fuso alvo
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(startsAt);
    const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
    const m = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
    const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
    const localDate = new Date(Date.UTC(y, m, d));
    const day = localDate.getUTCDay();

    if (!activeRule.days.includes(day)) {
      return false;
    }
  } else {
    // Se for override com lista de dias vazia, significa indisponível
    const isOverride =
      rules.overrides &&
      rules.overrides.some((ov) => {
        return ov.startDate && ov.endDate && startKey >= ov.startDate && startKey <= ov.endDate;
      });
    if (isOverride) {
      return false;
    }
  }

  // Validação do horário de funcionamento
  if (activeRule.startTime && activeRule.endTime) {
    const [startH, startM] = activeRule.startTime.split(":").map(Number);
    const [endH, endM] = activeRule.endTime.split(":").map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    // Horário de início em minutos no timezone alvo
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    const tParts = timeFormatter.formatToParts(startsAt);
    const sHour = parseInt(tParts.find((p) => p.type === "hour")!.value, 10);
    const sMin = parseInt(tParts.find((p) => p.type === "minute")!.value, 10);
    const currentStartTotal = sHour * 60 + sMin;

    const currentEndTotal = currentStartTotal + durationMinutes;

    // início >= abertura && fim <= fechamento
    if (currentStartTotal < startTotal || currentEndTotal > endTotal) {
      return false;
    }
  }

  return true;
}
