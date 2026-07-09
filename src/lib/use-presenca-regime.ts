// Hook do Semáforo de Presença.
// - Estado (verde/amarelo/azul/vermelho) persiste no backend (uma linha por usuário).
// - Nota efêmera fica só no dispositivo via localStorage (não vai pro banco).
// - Nota é enviada ao chat junto com a mensagem (campo `presencaNota` no envelope).

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PresencaState = "green" | "yellow" | "blue" | "red";

export const PRESENCA_META: Record<
  PresencaState,
  { label: string; short: string; dot: string; ring: string; chip: string; glow: string }
> = {
  green: {
    label: "Verde · fluxo aberto",
    short: "Verde",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/40",
    chip: "border-emerald-500/60 text-emerald-200 bg-emerald-500/10",
    glow: "shadow-[0_0_6px_rgba(16,185,129,0.7)]",
  },
  yellow: {
    label: "Amarelo · atenção mediada",
    short: "Amarelo",
    dot: "bg-amber-400",
    ring: "ring-amber-400/40",
    chip: "border-amber-400/60 text-amber-100 bg-amber-400/10",
    glow: "shadow-[0_0_6px_rgba(251,191,36,0.7)]",
  },
  blue: {
    label: "Azul · presença calma",
    short: "Azul",
    dot: "bg-sky-400",
    ring: "ring-sky-400/40",
    chip: "border-sky-400/60 text-sky-100 bg-sky-400/10",
    glow: "shadow-[0_0_6px_rgba(56,189,248,0.7)]",
  },
  red: {
    label: "Vermelho · limite ativo",
    short: "Vermelho",
    dot: "bg-rose-500",
    ring: "ring-rose-500/40",
    chip: "border-rose-500/60 text-rose-100 bg-rose-500/10",
    glow: "shadow-[0_0_6px_rgba(244,63,94,0.7)]",
  },
};

const NOTA_KEY_PREFIX = "kaline:presenca-nota:";

function getCurrentUserId(): Promise<string | null> {
  return supabase.auth.getUser().then((r) => r.data.user?.id ?? null);
}

export function usePresencaRegime() {
  const qc = useQueryClient();

  const stateQuery = useQuery({
    queryKey: ["presenca-regime"],
    queryFn: async (): Promise<PresencaState | null> => {
      const userId = await getCurrentUserId();
      if (!userId) return null;
      const { data } = await supabase
        .from("presenca_regimes")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();
      return (data?.state as PresencaState | undefined) ?? null;
    },
    staleTime: 60_000,
  });

  const setState = useMutation({
    mutationFn: async (next: PresencaState) => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Não autenticado.");
      const { error } = await supabase
        .from("presenca_regimes")
        .upsert(
          { user_id: userId, state: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["presenca-regime"] });
      const prev = qc.getQueryData<PresencaState | null>(["presenca-regime"]);
      qc.setQueryData(["presenca-regime"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["presenca-regime"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["presenca-regime"] });
    },
  });

  // ─── Nota efêmera (localStorage) ─────────────────────────────────────────
  const [nota, setNotaState] = useState<string>("");

  useEffect(() => {
    (async () => {
      const userId = await getCurrentUserId();
      if (!userId) return;
      try {
        const v = localStorage.getItem(NOTA_KEY_PREFIX + userId);
        if (v != null) setNotaState(v);
      } catch {
        // ignore
      }
    })();
  }, []);

  const setNota = useCallback(async (value: string) => {
    setNotaState(value);
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      if (value.trim()) localStorage.setItem(NOTA_KEY_PREFIX + userId, value);
      else localStorage.removeItem(NOTA_KEY_PREFIX + userId);
    } catch {
      // ignore
    }
  }, []);

  return {
    state: stateQuery.data ?? null,
    isLoading: stateQuery.isLoading,
    setState: setState.mutate,
    nota,
    setNota,
  };
}

// Leitura síncrona da nota efêmera (usada pelo composer do chat na hora de
// enviar mensagem). Retorna string vazia se não houver sessão/nota.
export async function readPresencaNota(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) return "";
  try {
    return (localStorage.getItem(NOTA_KEY_PREFIX + userId) ?? "").slice(0, 280);
  } catch {
    return "";
  }
}
