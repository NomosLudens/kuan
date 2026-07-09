// Klio — interface voice-first para o filho do usuário.
// Conecta à Kháris (facet="kharis") com linguagem simples e acessível.
// Reutiliza VoiceFirstChatView com tema vinho e avatar da Klio.

import { klioAvatar } from "@/lib/brand-assets";
import { VoiceFirstChatView } from "@/components/VoiceFirstChatView";

export type KlioVoiceViewProps = {
  threadId: string;
};

const KLIO_THEME = {
  accent: "#7A1F2B",
  accentSoft: "color-mix(in oklab, #7A1F2B 16%, transparent)",
  background: "#08080E",
};

export function KlioVoiceView({ threadId }: KlioVoiceViewProps) {
  if (!threadId) {
    return (
      <div
        className="flex h-full min-h-[calc(100dvh-3.5rem)] items-center justify-center"
        style={{ background: "#08080E", color: "#F3EBDD" }}
      >
        <p className="text-sm opacity-60">Iniciando Klio...</p>
      </div>
    );
  }

  return (
    <VoiceFirstChatView
      mode="klio"
      facet="kharis"
      threadId={threadId}
      avatarUrl={klioAvatar.url}
      label="Klio"
      theme={KLIO_THEME}
      autoSpeak={true}
    />
  );
}
