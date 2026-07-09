// Kaline Presente — interface voice-first para o admin.
// Conecta à Kaline (facet="kaline") com avatar e cores da Kaline.
// Reutiliza VoiceFirstChatView com tema laranja.

import { kalineAvatar } from "@/lib/brand-assets";
import { VoiceFirstChatView } from "@/components/VoiceFirstChatView";

export type KalinePresenteViewProps = {
  threadId: string;
};

const KALINE_THEME = {
  accent: "#ff4400",
  accentSoft: "color-mix(in oklab, #ff4400 16%, transparent)",
  background: "#08080E",
};

export function KalinePresenteView({ threadId }: KalinePresenteViewProps) {
  if (!threadId) {
    return (
      <div
        className="flex h-full min-h-[calc(100dvh-3.5rem)] items-center justify-center"
        style={{ background: "#08080E", color: "#F3EBDD" }}
      >
        <p className="text-sm opacity-60">Iniciando Kaline Presente...</p>
      </div>
    );
  }

  return (
    <VoiceFirstChatView
      mode="kaline-presente"
      facet="kaline"
      threadId={threadId}
      avatarUrl={kalineAvatar.url}
      label="Kaline"
      theme={KALINE_THEME}
      autoSpeak={true}
    />
  );
}
