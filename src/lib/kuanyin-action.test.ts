import { describe, expect, it } from "vitest";
import { extractKuanyinActions } from "./kuanyin-action";

const fence = (json: string) => `texto\n\n\`\`\`kuanyin-action\n${json}\n\`\`\``;

describe("extractKuanyinActions", () => {
  it("extracts one valid renderable action", () => {
    const result = extractKuanyinActions(
      fence(
        JSON.stringify({
          type: "kuanyin.appointment.propose",
          summary: "Propor horário",
          data: { service_name: "Consulta", starts_at: "2026-07-01T10:00:00Z" },
        }),
      ),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.invalidCount).toBe(0);
    expect(result.clean).toBe("texto");
  });

  it("rejects invalid JSON", () => {
    const result = extractKuanyinActions(fence("{"));
    expect(result.actions).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it("rejects unknown action type", () => {
    const result = extractKuanyinActions(
      fence(JSON.stringify({ type: "x", summary: "x", data: {} })),
    );
    expect(result.actions).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it("rejects missing required fields", () => {
    const result = extractKuanyinActions(
      fence(JSON.stringify({ type: "kuanyin.order.propose", summary: "Pedido", data: {} })),
    );
    expect(result.actions).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it("never executes more than one action", () => {
    const a = JSON.stringify({
      type: "kuanyin.client.create",
      summary: "Cliente",
      data: { nome: "Ana" },
    });
    const result = extractKuanyinActions(`${fence(a)}\n${fence(a)}`);
    expect(result.actions).toHaveLength(1);
    expect(result.invalidCount).toBe(1);
  });
});

describe("extractKuanyinActions plan actions", () => {
  it("accepts the three Kuan plan action types", () => {
    for (const json of [
      JSON.stringify({
        type: "kuanyin.plan.direction.propose",
        summary: "Direção",
        data: { current_direction: "Priorizar domiciliar" },
      }),
      JSON.stringify({
        type: "kuanyin.plan.decision.propose",
        summary: "Decisão",
        data: {
          title: "Preço",
          decision_type: "pricing",
          decision: "Revisar preços",
          review_at: "2026-08-15T09:00:00-03:00",
        },
      }),
      JSON.stringify({
        type: "kuanyin.plan.milestone.propose",
        summary: "Marco",
        data: { title: "Revisar preços", due_at: "2026-08-15T18:00:00-03:00" },
      }),
    ]) {
      expect(extractKuanyinActions(fence(json)).actions).toHaveLength(1);
    }
  });
  it("rejects unknown action types, decisions without decision text and invalid dates", () => {
    expect(
      extractKuanyinActions(
        fence(JSON.stringify({ type: "kuanyin.plan.unknown", summary: "x", data: {} })),
      ).invalidCount,
    ).toBe(1);
    expect(
      extractKuanyinActions(
        fence(
          JSON.stringify({
            type: "kuanyin.plan.decision.propose",
            summary: "x",
            data: { title: "Preço" },
          }),
        ),
      ).invalidCount,
    ).toBe(1);
    expect(
      extractKuanyinActions(
        fence(
          JSON.stringify({
            type: "kuanyin.plan.milestone.propose",
            summary: "x",
            data: { title: "Marco", due_at: "not-a-date" },
          }),
        ),
      ).invalidCount,
    ).toBe(1);
  });
});
