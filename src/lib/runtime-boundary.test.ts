import { describe, it, expect } from "vitest";
import { resolveRuntimeBoundary } from "./runtime-boundary";

describe("resolveRuntimeBoundary", () => {
  it("kaline/default não bloqueia e retorna runtimeFacet kuanyin", () => {
    const result = resolveRuntimeBoundary({ facet: "kaline", surface: "kaline", mode: "default" });
    expect(result).toEqual({ blocked: false, runtimeFacet: "kuanyin" });
  });

  it("kuanyin é escopo comercial permitido", () => {
    const result = resolveRuntimeBoundary({ facet: "kuanyin" });
    expect(result).toEqual({ blocked: false, runtimeFacet: "kuanyin" });
  });

  it("mode commercial é permitido", () => {
    const result = resolveRuntimeBoundary({ mode: "commercial" });
    expect(result).toEqual({ blocked: false, runtimeFacet: "kuanyin" });
  });

  it("surface klio bloqueia para Klio", () => {
    const result = resolveRuntimeBoundary({ surface: "klio" });
    expect(result).toEqual({
      blocked: true,
      targetApp: "klio-coder",
      reason: "out_of_scope",
      message: "Kuan-Yin não escreve código. Esse escopo será atendido em app separado: Klio.",
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

  it("kharis pessoal bloqueia fora da Kuan-Yin", () => {
    const result = resolveRuntimeBoundary({ facet: "kharis" });
    expect(result).toEqual({
      blocked: true,
      reason: "personal_kaline_scope",
      message: "Esse pedido pertence à Kaline pessoal, não à Kuan-Yin comercial.",
    });
  });

  it("pedido fora de escopo não aponta automaticamente para Klio", () => {
    const result = resolveRuntimeBoundary({ latestUserText: "quero abrir o Drive" });
    expect(result).toEqual({
      blocked: true,
      reason: "out_of_scope",
      message: "Esse pedido está fora do escopo da Kuan-Yin comercial.",
    });
  });

  it("texto comum com palavra 'app' não bloqueia", () => {
    const result = resolveRuntimeBoundary({ latestUserText: "como eu baixo esse app novo?" });
    expect(result.blocked).toBe(false);
  });
});
