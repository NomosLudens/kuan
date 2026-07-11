import { describe, it, expect } from "vitest";
import {
  normalizeAvailabilityRules,
  isPastOrTooSoon,
  isWithinAvailabilityRules,
  getAvailabilityViolationMessage,
  formatAvailabilitySummary,
} from "./availability-rules";

describe("Availability Rules Engine", () => {
  describe("normalizeAvailabilityRules", () => {
    it("should handle empty or null values with default rules", () => {
      const rules = normalizeAvailabilityRules(null);
      expect(rules.days).toEqual([]);
      expect(rules.startTime).toBeNull();
      expect(rules.endTime).toBeNull();
      expect(rules.defaultDurationMinutes).toBe(60);
      expect(rules.minimumNoticeHours).toBe(0);
      expect(rules.blockConfirmedConflicts).toBe(true);
    });

    it("should parse legacy format string", () => {
      // Raw string which does not have key:value pairs will have days empty because parseTextLinesToRecord yields no key-value
      const legacyRules = "Segunda a sexta das 10h às 19h.";
      const rules = normalizeAvailabilityRules(legacyRules);
      expect(rules.days).toEqual([]);
      expect(rules.notes).toBeNull();
    });

    it("should parse new structured format object", () => {
      const structured = {
        dias_atendimento: [1, 3, 5],
        hora_inicio: "08:30",
        hora_fim: "17:00",
        duracao_padrao_minutos: 45,
        antecedencia_minima_horas: 12,
        bloquear_conflito_confirmado: false,
        notes: "Estacionamento conveniado no local.",
        mensagem_indisponivel: "Por favor escolha outro horário comercial.",
      };
      const rules = normalizeAvailabilityRules(structured);
      expect(rules.days).toEqual([1, 3, 5]);
      expect(rules.startTime).toBe("08:30");
      expect(rules.endTime).toBe("17:00");
      expect(rules.defaultDurationMinutes).toBe(45);
      expect(rules.minimumNoticeHours).toBe(12);
      expect(rules.blockConfirmedConflicts).toBe(false);
      expect(rules.notes).toBe("Estacionamento conveniado no local.");
      expect(rules.unavailableMessage).toBe("Por favor escolha outro horário comercial.");
    });
  });

  describe("isPastOrTooSoon", () => {
    const rules = {
      days: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "18:00",
      defaultDurationMinutes: 60,
      minimumNoticeHours: 24,
      blockConfirmedConflicts: true,
      notes: null,
      unavailableMessage: "",
    };

    it("should return true for past dates", () => {
      const now = new Date("2026-07-15T12:00:00");
      const past = new Date("2026-07-14T12:00:00");
      expect(isPastOrTooSoon(past, rules, now)).toBe(true);
    });

    it("should return true for dates violating minimum notice", () => {
      const now = new Date("2026-07-15T12:00:00");
      // 12 hours from now (notice requires 24h)
      const soon = new Date("2026-07-16T00:00:00");
      expect(isPastOrTooSoon(soon, rules, now)).toBe(true);
    });

    it("should return false for valid future dates after notice period", () => {
      const now = new Date("2026-07-15T12:00:00");
      // 25 hours from now
      const validFuture = new Date("2026-07-16T13:00:00");
      expect(isPastOrTooSoon(validFuture, rules, now)).toBe(false);
    });
  });

  describe("isWithinAvailabilityRules", () => {
    const rules = {
      days: [1, 3, 5], // Monday, Wednesday, Friday
      startTime: "09:00",
      endTime: "18:00",
      defaultDurationMinutes: 60,
      minimumNoticeHours: 24,
      blockConfirmedConflicts: true,
      notes: null,
      unavailableMessage: "",
    };

    it("should return true for allowed weekday and hour", () => {
      // 2026-07-15 is Wednesday. 10:00 AM is within 09:00 - 18:00
      const slot = new Date("2026-07-15T10:00:00");
      expect(isWithinAvailabilityRules(slot, rules)).toBe(true);
    });

    it("should return false for disallowed weekday", () => {
      // 2026-07-14 is Tuesday. Not in [1, 3, 5]
      const slot = new Date("2026-07-14T10:00:00");
      expect(isWithinAvailabilityRules(slot, rules)).toBe(false);
    });

    it("should return false for out of bounds hour (before)", () => {
      // Wednesday, 08:30 AM (starts at 09:00)
      const slot = new Date("2026-07-15T08:30:00");
      expect(isWithinAvailabilityRules(slot, rules)).toBe(false);
    });

    it("should return false for out of bounds hour (after)", () => {
      // Wednesday, 18:30 PM (ends at 18:00)
      const slot = new Date("2026-07-15T18:30:00");
      expect(isWithinAvailabilityRules(slot, rules)).toBe(false);
    });
  });

  describe("getAvailabilityViolationMessage", () => {
    const rules = {
      days: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "18:00",
      defaultDurationMinutes: 60,
      minimumNoticeHours: 24,
      blockConfirmedConflicts: true,
      notes: null,
      unavailableMessage: "Apenas horários comerciais permitidos.",
    };

    it("should map violation reasons to standard copy messages", () => {
      expect(getAvailabilityViolationMessage("past", rules)).toContain("passou");
      expect(getAvailabilityViolationMessage("too_soon", rules)).toContain("muito próximo");
    });

    it("should return custom message if defined for outside_availability", () => {
      expect(getAvailabilityViolationMessage("outside_availability", rules)).toBe(
        rules.unavailableMessage,
      );
    });
  });

  describe("formatAvailabilitySummary", () => {
    it("should render clean natural text summary", () => {
      const rules = {
        days: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "18:00",
        defaultDurationMinutes: 60,
        minimumNoticeHours: 24,
        blockConfirmedConflicts: true,
        notes: null,
        unavailableMessage: "",
      };
      const summary = formatAvailabilitySummary(rules);
      expect(summary).toContain("segunda a sexta");
      expect(summary).toContain("09:00 às 18:00");
      expect(summary).toContain("24h");
    });
  });
});
