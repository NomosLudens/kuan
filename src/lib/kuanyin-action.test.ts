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
