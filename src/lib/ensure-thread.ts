// Garante que exista exatamente uma thread por faceta para o usuário atual.
// Retorna o id da thread (a mais recente, caso já exista mais de uma por legado).
import { supabase } from "@/integrations/supabase/client";

export type ChatFacet = "kaline" | "kharis" | "kuanyin";

const TITLES: Record<ChatFacet, string> = {
  kaline: "Kaline",
  kharis: "Kháris",
  kuanyin: "Kuan-Yin · comercial",
};
const SURFACES: Record<ChatFacet, string> = {
  kaline: "kaline",
  kharis: "kharis",
  kuanyin: "kuanyin",
};

export async function ensureThread(facet: ChatFacet): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data: existing } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("facet", facet)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from("chat_threads")
    .insert({
      user_id: userRes.user.id,
      facet,
      surface: SURFACES[facet],
      title: TITLES[facet],
    })
    .select("id")
    .single();
  return created?.id ?? null;
}
