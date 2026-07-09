import { describe, expect, it, vi } from "vitest";
import {
  buildVoiceChatPayload,
  buildVoiceUserMessage,
  facetForVoiceDomain,
  lastSentenceBoundary,
  speechProfileForVoice,
  voiceErrorMessage,
  voiceStateLabel,
} from "./voice-interaction";

describe("voice interaction helpers", () => {
  it("keeps Klio on the Kharis technical facet", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");

    const message = buildVoiceUserMessage("Me ajuda com a tarefa.");
    const payload = buildVoiceChatPayload(
      {
        domain: "kharis",
        surface: "klio",
        mode: "pedagogical",
        threadId: "11111111-1111-4111-8111-111111111111",
      },
      [message],
    );

    expect(payload.facet).toBe("kharis");
    expect(payload).not.toHaveProperty("engineFacet");
    expect(payload.surface).toBe("klio");
    expect(payload.mode).toBe("pedagogical");
    expect(payload.messages[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      role: "user",
      parts: [{ type: "text", text: "Me ajuda com a tarefa." }],
    });
  });

  it("keeps the provided voice history in the payload", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");

    const previous = {
      id: "22222222-2222-4222-8222-222222222222",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Claro. Vamos por partes." }],
    };
    const next = buildVoiceUserMessage("Continua daqui.");
    const payload = buildVoiceChatPayload(
      {
        domain: "kaline",
        surface: "kaline",
        threadId: "11111111-1111-4111-8111-111111111111",
      },
      [previous, next],
    );

    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0]).toMatchObject(previous);
    expect(payload.messages[1]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000002",
      role: "user",
      parts: [{ type: "text", text: "Continua daqui." }],
    });
  });

  it("maps domains to existing technical facets only", () => {
    expect(facetForVoiceDomain("kaline")).toBe("kaline");
    expect(facetForVoiceDomain("kharis")).toBe("kharis");
    expect(facetForVoiceDomain("kuanyin")).toBe("kuanyin");
  });

  it("selects speech profile by surface and domain", () => {
    expect(speechProfileForVoice({ domain: "kharis", surface: "klio" })).toBe("klio");
    expect(speechProfileForVoice({ domain: "kharis" })).toBe("kharis");
    expect(speechProfileForVoice({ domain: "kaline" })).toBe("kaline");
  });

  it("has human labels for required states and microphone errors", () => {
    expect(voiceStateLabel("recording")).toBe("Gravando");
    expect(voiceStateLabel("blocked")).toBe("Microfone bloqueado");
    expect(voiceErrorMessage("microphone-blocked")).toContain("microfone");
    expect(voiceErrorMessage("short-recording")).toContain("curta");
  });

  it("finds the boundary right after the last sentence-ending punctuation", () => {
    expect(lastSentenceBoundary("Ola. Tudo bem")).toBe(4);
    expect(lastSentenceBoundary("Primeira frase. Segunda frase completa!")).toBe(39);
    expect(lastSentenceBoundary("sem pontuacao ainda")).toBe(0);
    expect(lastSentenceBoundary("")).toBe(0);
  });
});
