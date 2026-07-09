import { kalineAvatar, kharisAvatar, khoraAvatar, kuanyinAvatar } from "@/lib/brand-assets";
import { Link, useSearch } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LazyMarkdown } from "@/components/LazyMarkdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Camera,
  FileText,
  ImageIcon,
  Send,
  Square,
  Mic,
  Loader2,
  Volume2,
  Paperclip,
  X,
  GitBranch,
  Play,
} from "lucide-react";
import { KittScanner, type KittState } from "@/components/KittScanner";
import { setKittPulse, useKittPulse } from "@/lib/kitt-pulse";
import { toast } from "sonner";
import { useProfile } from "@/lib/use-profile";

import { readPresencaNota } from "@/lib/use-presenca-regime";
import { useTTS } from "@/lib/use-tts";
import { useChatModel } from "@/lib/use-chat-model";
import { isSTTModel, STT_FALLBACK_MODEL_KEY, STT_MODEL_KEY } from "@/lib/stt-models";
import { KuanyinActionCard } from "@/components/KuanyinActionCard";
import { extractActions } from "@/lib/kuanyin-action";
import { sanitizeAssistantOutput } from "@/lib/sanitize-assistant-output";

// Faceta "kharis" = superfície de cuidado neurodivergente (antigo valor de enum 'klio',
// renomeado em 20260626010000).
type EngineFacet = "kaline" | "kharis" | "kuanyin";
type VisualFacet = EngineFacet | "khora";

type Attachment = {
  name: string;
  kind: "text" | "image" | "pdf";
  content: string;
  mediaType?: string;
};

type FacetTheme = {
  label: string;
  avatar: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  chipActiveBg: string;
  chipActiveText: string;
  chipBorder: string;
  headerGlow: string;
  assistantBorder: string;
  assistantBg: string;
  userBorder: string;
  userBg: string;
  userAvatarBg: string;
  composerFocus: string;
  composerRing: string;
  sendClass: string;
  micReadyClass: string;
  micRecordingClass: string;
  thinkingLabel: string;
  emptyState: string;
};

const FACET_THEMES: Record<VisualFacet, FacetTheme> = {
  kaline: {
    label: "Kaline",
    avatar: kalineAvatar.url,
    subtitle: "presença geral",
    accent: "var(--kaline)",
    accentSoft: "color-mix(in oklab, var(--kaline) 16%, transparent)",
    accentText: "var(--kaline)",
    chipActiveBg: "color-mix(in oklab, var(--kaline) 18%, transparent)",
    chipActiveText: "var(--ivory)",
    chipBorder: "color-mix(in oklab, var(--kaline) 28%, transparent)",
    headerGlow: "0 0 24px color-mix(in oklab, var(--kaline) 18%, transparent)",
    assistantBorder: "color-mix(in oklab, var(--kaline) 22%, transparent)",
    assistantBg:
      "linear-gradient(180deg, color-mix(in oklab, var(--kaline) 6%, transparent), transparent)",
    userBorder: "color-mix(in oklab, var(--kaline) 34%, transparent)",
    userBg: "color-mix(in oklab, var(--kaline) 12%, transparent)",
    userAvatarBg: "color-mix(in oklab, var(--kaline) 18%, transparent)",
    composerFocus: "var(--kaline)",
    composerRing: "0 0 0 1px color-mix(in oklab, var(--kaline) 40%, transparent)",
    sendClass:
      "border border-[color:var(--kaline)]/35 bg-[color:var(--kaline)] text-[color:var(--obsidian)] hover:bg-[color:var(--kaline)]/90",
    micReadyClass:
      "bg-[color:var(--kaline)] text-[color:var(--obsidian)] hover:bg-[color:var(--kaline)]/90",
    micRecordingClass:
      "bg-[color:var(--kaline)]/22 text-[color:var(--ivory)] border-[color:var(--kaline)]/35 animate-pulse",
    thinkingLabel: "Kaline está pensando...",
    emptyState: "Fala comigo. Aqui é conversa, não sala de aula.",
  },
  khora: {
    label: "Khora",
    avatar: khoraAvatar.url,
    subtitle: "treino e presença corporal",
    accent: "#C98A65",
    accentSoft: "color-mix(in oklab, #C98A65 16%, transparent)",
    accentText: "#C98A65",
    chipActiveBg: "color-mix(in oklab, #C98A65 18%, transparent)",
    chipActiveText: "var(--ivory)",
    chipBorder: "color-mix(in oklab, #C98A65 28%, transparent)",
    headerGlow: "0 0 24px color-mix(in oklab, #C98A65 18%, transparent)",
    assistantBorder: "color-mix(in oklab, #C98A65 24%, transparent)",
    assistantBg:
      "linear-gradient(180deg, color-mix(in oklab, #C98A65 8%, transparent), transparent)",
    userBorder: "color-mix(in oklab, #C98A65 34%, transparent)",
    userBg: "color-mix(in oklab, #C98A65 12%, transparent)",
    userAvatarBg: "color-mix(in oklab, #C98A65 18%, transparent)",
    composerFocus: "#C98A65",
    composerRing: "0 0 0 1px color-mix(in oklab, #C98A65 40%, transparent)",
    sendClass: "border border-[#C98A65]/35 bg-[#C98A65] text-[#08080E] hover:bg-[#C98A65]/90",
    micReadyClass: "bg-[#C98A65] text-[#08080E] hover:bg-[#C98A65]/90",
    micRecordingClass:
      "bg-[#C98A65]/22 text-[color:var(--ivory)] border-[#C98A65]/35 animate-pulse",
    thinkingLabel: "Khora está pensando...",
    emptyState: "Vamos ajustar o treino de hoje com presença e segurança.",
  },
  kharis: {
    label: "Kháris",
    avatar: kharisAvatar.url,
    subtitle: "cuidado neurodivergente",
    accent: "var(--kharis)",
    accentSoft: "color-mix(in oklab, var(--kharis) 16%, transparent)",
    accentText: "var(--ivory)",
    chipActiveBg: "color-mix(in oklab, var(--kharis) 56%, transparent)",
    chipActiveText: "var(--ivory)",
    chipBorder: "color-mix(in oklab, var(--kharis) 38%, transparent)",
    headerGlow: "0 0 24px color-mix(in oklab, var(--kharis) 22%, transparent)",
    assistantBorder: "color-mix(in oklab, var(--kharis) 26%, transparent)",
    assistantBg:
      "linear-gradient(180deg, color-mix(in oklab, var(--kharis) 12%, transparent), transparent)",
    userBorder: "color-mix(in oklab, var(--kharis) 42%, transparent)",
    userBg: "color-mix(in oklab, var(--kharis) 22%, transparent)",
    userAvatarBg: "color-mix(in oklab, var(--kharis) 28%, transparent)",
    composerFocus: "var(--kharis)",
    composerRing: "0 0 0 1px color-mix(in oklab, var(--kharis) 50%, transparent)",
    sendClass:
      "border border-[color:var(--kharis)]/40 bg-[color:var(--kharis)] text-[color:var(--ivory)] hover:bg-[color:var(--kharis)]/90",
    micReadyClass:
      "bg-[color:var(--kharis)] text-[color:var(--ivory)] hover:bg-[color:var(--kharis)]/90",
    micRecordingClass:
      "bg-[color:var(--kharis)]/28 text-[color:var(--ivory)] border-[color:var(--kharis)]/40 animate-pulse",
    thinkingLabel: "Kháris está pensando...",
    emptyState: "Conta pra mim o que você precisa. Vou com calma, passo a passo.",
  },
  kuanyin: {
    label: "Kuan-Yin",
    avatar: kuanyinAvatar.url,
    subtitle: "negócio, clientes e operação",
    accent: "var(--kuanyin)",
    accentSoft: "color-mix(in oklab, var(--kuanyin) 18%, transparent)",
    accentText: "color-mix(in oklab, var(--kuanyin) 35%, var(--ivory))",
    chipActiveBg: "color-mix(in oklab, var(--kuanyin) 22%, transparent)",
    chipActiveText: "var(--ivory)",
    chipBorder: "color-mix(in oklab, var(--kuanyin) 36%, transparent)",
    headerGlow: "0 0 24px color-mix(in oklab, var(--kuanyin) 22%, transparent)",
    assistantBorder: "color-mix(in oklab, var(--kuanyin) 28%, transparent)",
    assistantBg:
      "linear-gradient(180deg, color-mix(in oklab, var(--kuanyin) 10%, transparent), transparent)",
    userBorder: "color-mix(in oklab, var(--kuanyin) 42%, transparent)",
    userBg: "color-mix(in oklab, var(--kuanyin) 18%, transparent)",
    userAvatarBg: "color-mix(in oklab, var(--kuanyin) 22%, transparent)",
    composerFocus: "var(--kuanyin)",
    composerRing: "0 0 0 1px color-mix(in oklab, var(--kuanyin) 50%, transparent)",
    sendClass:
      "border border-[color:var(--kuanyin)]/40 bg-[color:var(--kuanyin)] text-[color:var(--ivory)] hover:bg-[color:var(--kuanyin)]/90",
    micReadyClass:
      "bg-[color:var(--kuanyin)] text-[color:var(--ivory)] hover:bg-[color:var(--kuanyin)]/90",
    micRecordingClass:
      "bg-[color:var(--kuanyin)]/24 text-[color:var(--ivory)] border-[color:var(--kuanyin)]/40 animate-pulse",
    thinkingLabel: "Kuan-Yin está pensando...",
    emptyState:
      "Estruture comigo o negócio, os serviços, a agenda, os clientes e os próximos passos.",
  },
};

const MessageBubble = memo(function MessageBubble({
  role,
  text,
  facetLabel,
  facetAvatarUrl,
  theme,
  userAvatarUrl,
  userInitial,
  userLabel,
  onSpeak,
  isSpeaking,
}: {
  role: "user" | "assistant";
  text: string;
  facetLabel: string;
  facetAvatarUrl: string;
  theme: FacetTheme;
  userAvatarUrl: string | null;
  userInitial: string;
  userLabel: string;
  onSpeak?: () => void;
  isSpeaking?: boolean;
}) {
  const mine = role === "user";

  if (mine) {
    return (
      <div className="flex justify-end items-start gap-2">
        <div className="flex max-w-[86%] flex-col items-end sm:max-w-[72%]">
          <div className="mb-1 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[color:var(--ivory-dim)]">
            <span>{userLabel}</span>
          </div>
          <div
            className="rounded-2xl px-3.5 py-2.5 text-[color:var(--ivory)] sm:px-4 sm:py-3"
            style={{
              background: theme.userBg,
              border: `1px solid ${theme.userBorder}`,
              boxShadow: `inset 0 1px 0 ${theme.accentSoft}`,
            }}
          >
            <div className="prose prose-sm prose-invert max-w-none break-words text-[0.98rem] leading-[1.5] sm:text-[1.04rem]">
              <LazyMarkdown>{text}</LazyMarkdown>
            </div>
          </div>
        </div>
        {userAvatarUrl ? (
          <img
            src={userAvatarUrl}
            alt=""
            className="mt-5 h-9 w-9 shrink-0 rounded-full border object-cover sm:h-[38px] sm:w-[38px]"
            style={{ borderColor: theme.userBorder }}
          />
        ) : (
          <div
            className="mt-5 grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs text-[color:var(--ivory)] sm:h-[38px] sm:w-[38px]"
            style={{
              background: theme.userAvatarBg,
              borderColor: theme.userBorder,
            }}
          >
            {userInitial}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-start items-start gap-2">
      <img
        src={facetAvatarUrl}
        alt=""
        className="mt-5 h-10 w-10 shrink-0 rounded-full object-cover"
        style={{ border: `1px solid ${theme.chipBorder}` }}
      />
      <div className="flex max-w-[86%] flex-col items-start sm:max-w-[78%]">
        <div
          className="mb-1 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase serif"
          style={{ color: theme.accentText }}
        >
          <span>{facetLabel}</span>
          {onSpeak && (
            <AudioMessageAction isSpeaking={Boolean(isSpeaking)} onSpeak={onSpeak} theme={theme} />
          )}
        </div>
        <div
          className="rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3"
          style={{
            background: theme.assistantBg,
            border: `1px solid ${theme.assistantBorder}`,
          }}
        >
          <div className="prose prose-sm prose-invert max-w-none break-words text-[0.98rem] leading-[1.5] sm:text-[1.04rem]">
            <LazyMarkdown>{text}</LazyMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
});

function AudioMessageAction({
  isSpeaking,
  onSpeak,
  theme,
}: {
  isSpeaking: boolean;
  onSpeak: () => void;
  theme: FacetTheme;
}) {
  return (
    <button
      type="button"
      onClick={onSpeak}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] normal-case tracking-normal transition"
      style={{
        color: isSpeaking ? theme.accentText : "var(--ivory-dim)",
        borderColor: isSpeaking
          ? theme.chipBorder
          : "color-mix(in oklab, var(--ivory) 12%, transparent)",
        background: isSpeaking
          ? theme.accentSoft
          : "color-mix(in oklab, var(--ivory) 5%, transparent)",
      }}
      aria-label={isSpeaking ? "Parar leitura" : "Ouvir mensagem"}
      title={isSpeaking ? "Parar leitura" : "Ouvir"}
    >
      <span
        className="grid h-5 w-5 place-items-center rounded-full"
        style={{ background: theme.accentSoft }}
      >
        {isSpeaking ? (
          <Square className="h-2.5 w-2.5" />
        ) : (
          <Play className="h-2.5 w-2.5 fill-current" />
        )}
      </span>
      <span className="flex h-4 items-center gap-0.5" aria-hidden>
        {[35, 60, 45, 75, 50].map((height, index) => (
          <span
            key={index}
            className="w-0.5 rounded-full bg-current opacity-70"
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
      <Volume2 className="h-3 w-3 opacity-70" aria-hidden />
    </button>
  );
}

function TypingDots({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 text-xs"
      style={{ color: "var(--ivory-dim)" }}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex gap-1" aria-hidden>
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:-200ms]"
          style={{ color }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:-100ms]"
          style={{ color }}
        />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" style={{ color }} />
      </span>
      <span className="italic">{label}</span>
    </div>
  );
}

function HistorySkeleton({ theme }: { theme: FacetTheme }) {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex justify-end">
        <div
          className="h-10 w-2/3 rounded-2xl"
          style={{ background: theme.userBg, border: `1px solid ${theme.userBorder}` }}
        />
      </div>
      <div className="flex justify-start">
        <div
          className="h-16 w-3/4 rounded-2xl"
          style={{ background: theme.assistantBg, border: `1px solid ${theme.assistantBorder}` }}
        />
      </div>
      <div className="flex justify-end">
        <div
          className="h-8 w-1/2 rounded-2xl"
          style={{ background: theme.userBg, border: `1px solid ${theme.userBorder}` }}
        />
      </div>
    </div>
  );
}

export interface ChatViewProps {
  threadId: string;
}

export function ChatView({ threadId }: ChatViewProps) {
  const search = useSearch({ strict: false });
  const seed = typeof search.seed === "string" ? search.seed : undefined;
  const visualFacet = search.facet === "khora" ? "khora" : undefined;

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [facet, setFacet] = useState<EngineFacet>("kharis");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const cameraAttachmentRef = useRef<HTMLInputElement>(null);
  const imageAttachmentRef = useRef<HTMLInputElement>(null);
  const fileAttachmentRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const seededRef = useRef<string | null>(null);
  const tts = useTTS();
  const { activeChatModel, setActiveChatModel, chatModels } = useChatModel();

  useEffect(() => {
    setInitialMessages(null);
    seededRef.current = null;
    stickToBottomRef.current = true;

    void (async () => {
      const { data: thread } = await supabase
        .from("chat_threads")
        .select("facet")
        .eq("id", threadId)
        .maybeSingle();
      const nextFacet = (thread?.facet as EngineFacet | undefined) ?? "kharis";
      setFacet(nextFacet);

      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("thread_id", threadId)
        .order("created_at");
      const msgs: UIMessage[] = (data ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [
          {
            type: "text",
            text: m.role === "assistant" ? sanitizeAssistantOutput(m.content) : m.content,
          },
        ],
      }));
      setInitialMessages(msgs);
    })();
  }, [threadId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { facet, threadId, chatModel: activeChatModel },
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);

          let body = init?.body;
          if (typeof body === "string") {
            try {
              const nota = await readPresencaNota();
              if (nota.trim()) {
                const parsed = JSON.parse(body) as Record<string, unknown>;
                parsed.presencaNota = nota;
                body = JSON.stringify(parsed);
                headers.set("content-type", "application/json");
              }
            } catch {
              // segue sem nota
            }
          }

          const hasFiles = typeof body === "string" && body.includes('"type":"file"');
          const timeoutMs = hasFiles ? 90_000 : 60_000;
          const controller = new AbortController();
          const onAbort = () => controller.abort();
          init?.signal?.addEventListener("abort", onAbort);
          const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

          try {
            const res = await fetch(input, { ...init, headers, body, signal: controller.signal });
            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              throw new Error(detail || `Falha ao enviar (HTTP ${res.status})`);
            }
            return res;
          } catch (error) {
            if (controller.signal.aborted && !init?.signal?.aborted) {
              throw new Error(
                "Não consegui concluir o processamento a tempo. O chat foi liberado para você tentar novamente.",
              );
            }
            throw error;
          } finally {
            window.clearTimeout(timeout);
            init?.signal?.removeEventListener("abort", onAbort);
          }
        },
      }),
    [activeChatModel, facet, threadId],
  );

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id: `${threadId}:${facet}:${visualFacet ?? ""}`,
    messages: initialMessages ?? [],
    transport,
    onError: (err) => {
      toast.error(err.message || "Falha ao enviar mensagem. Tente novamente.");
    },
  });

  // O useChat só usa `messages` para construir a instância Chat na 1ª vez que o
  // id aparece; como o histórico chega assíncrono (depois do null inicial),
  // empurramos manualmente assim que carrega — senão a conversa fica vazia.
  useEffect(() => {
    if (initialMessages !== null) setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";
  const activeFacet = visualFacet ?? facet;
  const theme = FACET_THEMES[activeFacet];

  // Salvaguarda: se ficar "pensando/respondendo" por muito tempo, oferece
  // destravar o chat sem precisar recarregar a página.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setStuck(false);
      return;
    }
    const timer = window.setTimeout(() => setStuck(true), 35_000);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  function destravarChat() {
    stop();
    setStuck(false);
    toast.message("Chat liberado. Você pode tentar novamente.");
  }

  // Propaga a cor da faceta ativa para o fundo ambiente da página (ver --facet-accent
  // em styles.css). Reseta ao desmontar para não "vazar" a cor ao navegar para fora do chat.
  useEffect(() => {
    document.body.style.setProperty("--facet-accent", theme.accent);
    return () => {
      document.body.style.removeProperty("--facet-accent");
    };
  }, [theme.accent]);

  useEffect(() => {
    if (!seed || seededRef.current === seed || initialMessages === null) return;
    seededRef.current = seed;
    if (initialMessages.length > 0) {
      setInput(seed);
      composerRef.current?.focus();
      toast.message("Mensagem da Khora preenchida com contexto do Corpore Sano.");
      return;
    }
    void sendMessage({ text: seed });
  }, [initialMessages, seed, sendMessage]);

  // ── Auto-scroll helpers ────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }, []);

  // Scroll ao montar chat inicial
  useEffect(() => {
    if (initialMessages !== null) {
      scrollToBottom("auto");
    }
  }, [initialMessages, scrollToBottom]);

  // Scroll ao trocar de thread
  useEffect(() => {
    if (initialMessages === null) return;
    scrollToBottom("auto");
  }, [threadId, initialMessages, scrollToBottom]);

  // Scroll ao mudar número de mensagens (durante streaming)
  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(isLoading ? "auto" : "smooth");
  }, [isLoading, messages, scrollToBottom]);

  // Scroll forçado ao enviar mensagem (mesmo que usuário estivesse acima)
  useEffect(() => {
    if (status === "submitted") {
      stickToBottomRef.current = true;
      scrollToBottom("smooth");
    }
  }, [status, scrollToBottom]);

  useEffect(() => {
    composerRef.current?.focus();
  }, [initialMessages, threadId]);

  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const maxHeight = window.matchMedia("(max-width: 640px)").matches ? 128 : 200;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  const { profile, avatarSignedUrl } = useProfile();
  const userLabel = profile?.display_name?.trim() || "Você";
  const userInitial = (userLabel[0] ?? "K").toUpperCase();
  function buildOutgoingText(baseText: string, list: Attachment[]) {
    const text = baseText.trim();
    const textBlocks = list
      .filter((file) => file.kind === "text")
      .map((file) => `[Anexo de texto: ${file.name}]\n${file.content}`);
    return [text, ...textBlocks].filter(Boolean).join("\n\n");
  }

  // Imagens e PDFs viram file parts multimodais; planilhas/Word/textos já foram
  // extraídos para texto e entram via buildOutgoingText.
  function buildFileParts(list: Attachment[]): FileUIPart[] {
    return list
      .filter((file) => file.kind === "image" || file.kind === "pdf")
      .map((file) => ({
        type: "file" as const,
        mediaType: file.mediaType ?? (file.kind === "pdf" ? "application/pdf" : "image/png"),
        filename: file.name,
        url: file.content,
      }));
  }

  // Envia texto + anexos numa tacada (usado pelo botão Enviar e pelo microfone).
  function enviar(baseText: string, list: Attachment[]) {
    const text = buildOutgoingText(baseText, list);
    const fileParts = buildFileParts(list);
    if ((!text && fileParts.length === 0) || isLoading) return;
    stickToBottomRef.current = true;
    void sendMessage(text ? { text, files: fileParts } : { files: fileParts });
    setInput("");
    setAttachments([]);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function submitMessage() {
    enviar(input, attachments);
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function onPickAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const next: Attachment[] = [];
    for (const file of files.slice(0, 4)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede 10 MB.`);
        continue;
      }
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isDocx = /\.docx$/i.test(file.name);
      try {
        if (file.type.startsWith("image/")) {
          next.push({
            name: file.name,
            kind: "image",
            content: await readAsDataUrl(file),
            mediaType: file.type || "image/png",
          });
        } else if (isPdf) {
          next.push({
            name: file.name,
            kind: "pdf",
            content: await readAsDataUrl(file),
            mediaType: "application/pdf",
          });
        } else if (isDocx) {
          const mammoth = await import("mammoth");
          const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
          next.push({ name: file.name, kind: "text", content: value });
        } else if (file.type === "text/plain" || /\.(txt|md)$/i.test(file.name)) {
          next.push({ name: file.name, kind: "text", content: await file.text() });
        } else {
          // .csv/.json e outros texto-crus são recusados: anexo cru injetado no
          // prompt amplia a superfície de prompt injection. Aceitos: imagem, PDF,
          // Word, .txt e .md. Para o resto, o usuário cola o conteúdo no chat.
          toast.error(`${file.name}: formato não aceito (use imagem, PDF, Word, .txt ou .md).`);
        }
      } catch {
        toast.error(`Falha ao ler ${file.name}.`);
      }
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 4));
    for (const ref of [cameraAttachmentRef, imageAttachmentRef, fileAttachmentRef]) {
      if (ref.current) ref.current.value = "";
    }
    setAttachmentMenuOpen(false);
  }

  useEffect(() => {
    if (status === "submitted") setKittPulse("chat", "thinking");
    else if (status === "streaming") setKittPulse("chat", "speaking");
    else setKittPulse("chat", null);
    return () => setKittPulse("chat", null);
  }, [status]);

  useEffect(() => {
    if (tts.error) toast.error(tts.error);
  }, [tts.error]);

  const kittState: KittState = useKittPulse("idle");

  const [micState, setMicState] = useState<"idle" | "recording" | "busy">("idle");
  const trimmedInput = input.trim();
  const canSend = trimmedInput.length > 0 || attachments.length > 0;
  const isTranscribing = micState === "busy";
  const isProcessing = status === "submitted" || isTranscribing;
  // Espelha os anexos para leitura sempre atual dentro do callback do gravador.
  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);

  function quickReview(raw: string): string {
    let next = raw.trim().replace(/\s+/g, " ");
    if (!next) return next;
    next = next.charAt(0).toUpperCase() + next.slice(1);
    if (!/[.!?…]$/.test(next)) next += ".";
    return next;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        toast.error("Navegador não suporta gravação em formato compatível.");
        return;
      }

      const rec = new MediaRecorder(stream, { mimeType });
      recChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recChunksRef.current, { type: rec.mimeType });
        if (blob.size < 1024) {
          setMicState("idle");
          setKittPulse("voice", null);
          toast.error("Gravação muito curta — tente de novo.");
          return;
        }

        setMicState("busy");
        setKittPulse("voice", "transcribing");

        try {
          const fd = new FormData();
          const ext =
            ({ "audio/webm": "webm", "audio/mp4": "mp4" } as Record<string, string>)[
              rec.mimeType.split(";")[0]
            ] ?? "webm";
          fd.append("file", blob, `recording.${ext}`);
          fd.append("revise", "1"); // pede revisão por LLM no servidor (só no chat)
          // Respeita a escolha de STT do Guardião (mesmo padrão do modo fala).
          const sttModel =
            typeof localStorage === "undefined" ? null : localStorage.getItem(STT_MODEL_KEY);
          if (isSTTModel(sttModel)) fd.append("sttModel", sttModel);
          const sttFallbackModel =
            typeof localStorage === "undefined"
              ? null
              : localStorage.getItem(STT_FALLBACK_MODEL_KEY);
          if (isSTTModel(sttFallbackModel)) fd.append("sttFallbackModel", sttFallbackModel);
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: fd,
          });
          if (!res.ok) throw new Error(await res.text());
          const parsed = (await res.json()) as { text?: string };
          const text = (parsed.text ?? "").trim();
          setMicState("idle");
          if (text) {
            // Envia direto: combina o que já estava digitado com a transcrição.
            const digitado = (composerRef.current?.value ?? "").trim();
            const combinado = quickReview(digitado ? `${digitado} ${text}` : text);
            enviar(combinado, attachmentsRef.current);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Falha na transcrição.");
          setMicState("idle");
        } finally {
          setKittPulse("voice", null);
        }
      };

      recorderRef.current = rec;
      rec.start();
      setMicState("recording");
      setKittPulse("voice", "listening");
    } catch {
      toast.error("Acesso ao microfone negado.");
    }
  }

  function stopRecording() {
    const current = recorderRef.current;
    if (current && current.state !== "inactive") current.stop();
  }

  function micClick() {
    if (isLoading) return;
    if (micState === "idle") return void startRecording();
    if (micState === "recording") return stopRecording();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-3 py-3 pb-6 sm:px-4 sm:py-5"
      >
        <div className="mx-auto max-w-3xl space-y-3 sm:space-y-5">
          {initialMessages === null && <HistorySkeleton theme={theme} />}

          {initialMessages !== null && messages.length === 0 && !isLoading && (
            <p className="mt-16 px-4 text-center text-sm text-[color:var(--ivory-dim)] sm:mt-20">
              {theme.emptyState}
            </p>
          )}

          {messages.map((m) => {
            const rawText = m.parts
              .map((p) => {
                if (p.type === "text") return p.text;
                if (p.type === "file" && p.mediaType?.startsWith("image/")) {
                  return `[Imagem enviada para interpretação: ${p.filename ?? "imagem"}]`;
                }
                return "";
              })
              .filter(Boolean)
              .join("\n\n");
            const isAssistant = m.role === "assistant";
            const safeText = isAssistant
              ? sanitizeAssistantOutput(rawText, { isLoading, status })
              : rawText;
            const { clean, actions } =
              isAssistant && facet === "kuanyin"
                ? extractActions(safeText)
                : { clean: safeText, actions: [] };

            return (
              <div key={m.id}>
                <MessageBubble
                  role={m.role as "user" | "assistant"}
                  text={clean}
                  facetLabel={theme.label}
                  facetAvatarUrl={theme.avatar}
                  theme={theme}
                  userAvatarUrl={avatarSignedUrl}
                  userInitial={userInitial}
                  userLabel={userLabel}
                  onSpeak={isAssistant && clean ? () => tts.speak(m.id, clean) : undefined}
                  isSpeaking={isAssistant && tts.speakingId === m.id}
                />
                {actions.map((action, index) => (
                  <KuanyinActionCard key={`${m.id}-action-${index}`} action={action} />
                ))}
              </div>
            );
          })}

          {status === "submitted" && (
            <TypingDots label={theme.thinkingLabel} color={theme.accent} />
          )}
          <div ref={bottomRef} aria-hidden className="h-1" />
        </div>
      </div>

      <div
        className="shrink-0 border-t bg-background/90 p-2.5 backdrop-blur sm:p-4"
        style={{
          borderColor: theme.chipBorder,
          paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex items-center gap-2 px-1">
            <KittScanner state={kittState} variant="ruby" height={18} />
            {stuck && (
              <button
                type="button"
                onClick={destravarChat}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)]"
                style={{ borderColor: theme.chipBorder }}
              >
                Destravar chat
              </button>
            )}
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              {attachments.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex max-w-full items-center gap-2 rounded-2xl border bg-card/85 px-2 py-1.5 text-xs text-[color:var(--ivory-dim)]"
                  style={{ borderColor: theme.chipBorder }}
                >
                  {file.kind === "image" && (
                    <img src={file.content} alt="" className="h-8 w-8 rounded-xl object-cover" />
                  )}
                  {file.kind === "image"
                    ? "Imagem para interpretar"
                    : file.kind === "pdf"
                      ? "PDF para leitura"
                      : "Texto"}
                  : {file.name}
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={cameraAttachmentRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={onPickAttachment}
            />
            <input
              ref={imageAttachmentRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickAttachment}
            />
            <input
              ref={fileAttachmentRef}
              type="file"
              accept=".txt,.md,.pdf,image/*,application/pdf,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              hidden
              onChange={onPickAttachment}
            />
            <div className="relative">
              <Button
                type="button"
                onClick={() => setAttachmentMenuOpen((open) => !open)}
                disabled={isLoading}
                variant="ghost"
                size="icon"
                className="mb-0.5 h-11 w-11 shrink-0 rounded-full border bg-card/70"
                style={{ borderColor: theme.chipBorder, color: theme.accentText }}
                aria-label="Abrir opções de anexo"
                title="Anexar"
                aria-expanded={attachmentMenuOpen}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              {attachmentMenuOpen && (
                <div
                  className="absolute bottom-14 left-0 z-20 w-56 rounded-3xl border bg-background/95 p-2 shadow-2xl backdrop-blur"
                  style={{ borderColor: theme.chipBorder, boxShadow: theme.headerGlow }}
                >
                  {[
                    {
                      label: "Tirar foto",
                      icon: Camera,
                      action: () => cameraAttachmentRef.current?.click(),
                    },
                    {
                      label: "Escolher imagem",
                      icon: ImageIcon,
                      action: () => imageAttachmentRef.current?.click(),
                    },
                    {
                      label: "Escolher arquivo",
                      icon: FileText,
                      action: () => fileAttachmentRef.current?.click(),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-[color:var(--ivory)] hover:bg-[color:var(--ivory)]/[0.06]"
                    >
                      <item.icon className="h-4 w-4" style={{ color: theme.accentText }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className="flex min-w-0 flex-1 items-end rounded-[1.6rem] bg-card/90 py-1 pl-3 pr-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.28)]"
              style={{
                border: `1px solid ${theme.chipBorder}`,
                boxShadow: `${theme.composerRing}, 0 18px 55px rgba(0,0,0,0.28)`,
              }}
            >
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitMessage();
                  }
                }}
                rows={1}
                placeholder={
                  micState === "recording"
                    ? "Gravando…"
                    : micState === "busy"
                      ? "Transcrevendo…"
                      : "Mensagem"
                }
                title="Shift+Enter quebra linha"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                className="max-h-32 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-base leading-snug outline-none placeholder:text-[color:var(--ivory-dim)]/55 sm:max-h-[200px]"
              />
              <Button
                type="button"
                asChild
                variant="ghost"
                size="icon"
                className="mb-0.5 h-9 w-9 shrink-0 rounded-full text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)]"
                aria-label="Trilha de sedimentação"
                title="Trilha de sedimentação"
              >
                <Link to="/trilha/$threadId" params={{ threadId }}>
                  <GitBranch className="h-4 w-4" />
                </Link>
              </Button>
              <span className="hidden pb-2 pr-1 text-[11px] text-[color:var(--ivory-dim)] lg:inline">
                Shift+Enter
              </span>
            </div>

            {isProcessing ? (
              <Button
                type="button"
                disabled
                size="icon"
                className={`mb-0.5 h-11 w-11 shrink-0 rounded-full opacity-80 ${theme.sendClass}`}
                aria-label="Processando"
                title="Processando"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
              </Button>
            ) : canSend ? (
              <Button
                type="button"
                onClick={submitMessage}
                size="icon"
                className={`mb-0.5 h-11 w-11 shrink-0 rounded-full ${theme.sendClass}`}
                aria-label="Enviar mensagem"
                title="Enviar mensagem"
              >
                <Send className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={micClick}
                size="icon"
                className={`mb-0.5 h-11 w-11 shrink-0 rounded-full ${theme.sendClass} ${
                  micState === "recording" ? theme.micRecordingClass : ""
                }`}
                aria-label={micState === "recording" ? "Parar gravação" : "Gravar áudio"}
                title={micState === "recording" ? "Parar gravação" : "Gravar áudio"}
              >
                {micState === "recording" ? (
                  <Square className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
