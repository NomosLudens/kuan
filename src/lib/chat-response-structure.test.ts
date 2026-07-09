import { describe, expect, it } from "vitest";
import { verifyChatResponseStructure } from "./chat-response-structure";

describe("verifyChatResponseStructure", () => {
  it("allows benign responses for all facets", () => {
    expect(
      verifyChatResponseStructure("kaline", "Claro. Posso te ajudar a organizar isso em passos."),
    ).toEqual([]);
    expect(
      verifyChatResponseStructure(
        "kharis",
        "Vamos simplificar: primeiro respira, depois escolhe uma tarefa pequena.",
      ),
    ).toEqual([]);
    expect(
      verifyChatResponseStructure(
        "kuanyin",
        "Posso preparar um preview para você confirmar antes de qualquer registro.",
      ),
    ).toEqual([]);
  });

  it("flags Kaline false execution claims", () => {
    const signals = verifyChatResponseStructure(
      "kaline",
      "Já plantei isso no Jardim e enviei para revisão.",
    );
    expect(signals.some((s) => s.category === "falsa_execucao")).toBe(true);
  });

  it("flags Kháris diagnosis claims", () => {
    const signals = verifyChatResponseStructure("kharis", "Você tem TDAH, esse é o diagnóstico.");
    expect(signals.some((s) => s.category === "diagnostico_indevido")).toBe(true);
  });

  it("keeps Kuan-Yin commercial protections", () => {
    expect(
      verifyChatResponseStructure("kuanyin", "Pagamento confirmado pelo comprovante."),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "pagamento_confirmado_por_comprovante" }),
      ]),
    );
    expect(verifyChatResponseStructure("kuanyin", "Seu horário reservado está garantido.")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "agendamento_confirmado_por_iniciativa" }),
      ]),
    );
    expect(verifyChatResponseStructure("kuanyin", "Corre que vai acabar, últimas vagas!")).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "urgencia_falsa" })]),
    );
    expect(
      verifyChatResponseStructure("kuanyin", "Uso OpenRouter API key no system prompt."),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "vazamento_de_prompt_ou_provedor" }),
      ]),
    );
  });
});
