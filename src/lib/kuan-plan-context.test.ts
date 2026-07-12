import { describe, expect, it } from "vitest";
import { renderKuanPlanContextBlock } from "./kuan/plan-context.server";

describe("renderKuanPlanContextBlock", () => {
  it("separates accepted rules from pending proposals and excludes inactive statuses", () => {
    const block = renderKuanPlanContextBlock({
      planId: "p1",
      plan: { current_direction: "Priorizar domiciliar", objectives: ["90 dias"] },
      decisions: [
        { id: "1", title: "Aceita", status: "accepted", decision_text: "Regra confirmada" },
        { id: "2", title: "Proposta", status: "proposed", decision_text: "Pendente" },
        { id: "3", title: "Antiga", status: "superseded", decision_text: "Histórico" },
        { id: "4", title: "Arquivada", status: "archived", decision_text: "Não usar" },
        { id: "5", title: "Rejeitada", status: "rejected", decision_text: "Não usar" },
      ],
      linkedClients: [
        { id: "c1", nome: "Cliente A", plan_id: "p1" },
        { id: "c2", nome: "Cliente B", plan_id: "p2" },
      ],
    });
    expect(block).toContain("DECISÕES CONFIRMADAS");
    expect(block).toContain("Aceita");
    expect(block).toContain("PROPOSTAS/PENDÊNCIAS");
    expect(block).toContain("Proposta");
    expect(block).not.toContain("Antiga");
    expect(block).not.toContain("Arquivada");
    expect(block).not.toContain("Rejeitada");
    expect(block).toContain("Cliente A");
    expect(block).not.toContain("Cliente B");
  });
  it("respects the maximum block size", () => {
    const block = renderKuanPlanContextBlock({
      plan: { current_direction: "x".repeat(20000), objectives: [] },
    });
    expect(block.length).toBeLessThanOrEqual(16000);
    expect(block).toContain("contexto truncado");
  });
});
