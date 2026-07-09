import { describe, it, expect } from "vitest";
import { resolveRuntimeBoundary } from "./runtime-boundary";

describe("resolveRuntimeBoundary", () => {
  it("kaline/default não bloqueia e retorna runtimeFacet kaline", () => {
    const result = resolveRuntimeBoundary({ facet: "kaline", surface: "kaline", mode: "default" });
    expect(result).toEqual({ blocked: false, runtimeFacet: "kaline" });
  });

  it("kuanyin bloqueia para targetApp kuan-yin", () => {
    const result = resolveRuntimeBoundary({ facet: "kuanyin" });
    expect(result).toEqual({
      blocked: true,
      targetApp: "kuan-yin",
      reason: "commercial_scope",
      message:
        "Kuan-Yin não está disponível na Kaline Clean. Esse escopo será reconstruído em app separado.",
    });
  });

  it("mode commercial bloqueia", () => {
    const result = resolveRuntimeBoundary({ mode: "commercial" });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.targetApp).toBe("kuan-yin");
    }
  });

  it("surface klio bloqueia para targetApp klio-coder", () => {
    const result = resolveRuntimeBoundary({ surface: "klio" });
    expect(result).toEqual({
      blocked: true,
      targetApp: "klio-coder",
      reason: "legacy_klio_scope",
      message:
        "Klio não está disponível na Kaline Clean. Esse escopo será atendido em app separado.",
    });
  });

  it("mode pedagogical bloqueia", () => {
    const result = resolveRuntimeBoundary({ mode: "pedagogical" });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.targetApp).toBe("klio-coder");
    }
  });

  it("pedido de programação bloqueia", () => {
    const result = resolveRuntimeBoundary({ latestUserText: "preciso de ajuda com o código" });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe("coding_scope");
    }
  });

  it("pedido de PR bloqueia", () => {
    const result = resolveRuntimeBoundary({ latestUserText: "pode revisar meu pull request?" });
    expect(result.blocked).toBe(true);
  });

  it("pedido de debug bloqueia", () => {
    const result = resolveRuntimeBoundary({
      latestUserText: "estou com um bug aqui, ajuda a fazer debug",
    });
    expect(result.blocked).toBe(true);
  });

  it("kharis não bloqueia e normaliza para kaline", () => {
    const result = resolveRuntimeBoundary({ facet: "kharis" });
    expect(result).toEqual({
      blocked: false,
      runtimeFacet: "kaline",
      note: "Kháris foi incorporada à Kaline como cuidado, presença e orientação simples.",
    });
  });

  it("texto comum com palavra 'app' não bloqueia", () => {
    const result = resolveRuntimeBoundary({ latestUserText: "como eu baixo esse app novo?" });
    expect(result.blocked).toBe(false);
  });
});
