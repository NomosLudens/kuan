// Hook simples para ler/escrever o perfil do usuário logado.
// avatar_url guarda o caminho dentro do bucket "avatares" (ex: "<uid>/avatar.jpg").
// O bucket é privado, então resolvemos uma URL assinada de 1h pra exibir.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Gender = "feminino" | "masculino" | "neutro";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null; // path dentro do bucket "avatares"
  gender: Gender | null;
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setProfile(null);
      setAvatarSignedUrl(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, gender")
      .eq("id", u.user.id)
      .maybeSingle();
    const raw = (data ?? { id: u.user.id, display_name: null, avatar_url: null, gender: null }) as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      gender: string | null;
    };
    const p: Profile = {
      id: raw.id,
      display_name: raw.display_name,
      avatar_url: raw.avatar_url,
      gender:
        raw.gender === "feminino" || raw.gender === "masculino" || raw.gender === "neutro"
          ? raw.gender
          : null,
    };
    setProfile(p);
    if (p.avatar_url) {
      const { data: s } = await supabase.storage
        .from("avatares")
        .createSignedUrl(p.avatar_url, 3600);
      setAvatarSignedUrl(s?.signedUrl ?? null);
    } else {
      setAvatarSignedUrl(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { profile, avatarSignedUrl, loading, reload: load };
}

export async function saveProfile(patch: {
  display_name?: string | null;
  avatar_url?: string | null;
  gender?: Gender | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: u.user.id, ...patch }, { onConflict: "id" });
  if (error) throw error;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const ext =
    (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${u.user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatares")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

// Helpers de pronome de tratamento baseado em gênero.
// Default: neutro/feminino quando desconhecido (histórico do app é feminino).
export function welcomeGreeting(gender: Gender | null | undefined): string {
  if (gender === "masculino") return "Bem-vindo de volta.";
  if (gender === "neutro") return "Bem-vinde de volta.";
  return "Bem-vinda de volta.";
}
