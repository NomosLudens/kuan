import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { saveProfile, uploadAvatar, useProfile } from "@/lib/use-profile";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function PerfilPage() {
  const { profile, avatarSignedUrl, loading, reload } = useProfile();
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setNome(profile.display_name ?? "");
  }, [profile]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 4 MB)");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadAvatar(file);
      await saveProfile({ avatar_url: path });
      await reload();
      toast.success("Avatar atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function salvarPerfil() {
    setSaving(true);
    try {
      await saveProfile({ display_name: nome.trim() || null });
      await reload();
      toast.success("Conta salva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function sair() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "/auth";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sair");
      setSigningOut(false);
    }
  }

  const initial = (nome.trim()[0] ?? profile?.display_name?.[0] ?? "G").toUpperCase();

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <h1 className="serif text-2xl text-[color:var(--gold)] tracking-[0.18em] uppercase mb-1">
        Conta do Guardião
      </h1>
      <p className="text-sm text-[color:var(--ivory-dim)] mb-8">
        Dados mínimos da sua conta neste app: nome ou apelido, avatar opcional e saída segura.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[color:var(--ivory-dim)]">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando…
        </div>
      ) : (
        <div className="space-y-8 rounded-3xl border border-[color:var(--border)] bg-card/50 p-5 sm:p-6">
          <section className="flex items-center gap-5">
            <div className="relative">
              {avatarSignedUrl ? (
                <img
                  src={avatarSignedUrl}
                  alt="Avatar do Guardião"
                  className="w-24 h-24 rounded-full object-cover border border-[color:var(--wine)]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[color:var(--wine)]/60 border border-[color:var(--wine)] grid place-items-center serif text-3xl text-[color:var(--ivory)]">
                  {initial}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[color:var(--wine)] border border-[color:var(--gold)] grid place-items-center text-[color:var(--ivory)] hover:bg-[color:var(--wine)]/80 disabled:opacity-50"
                aria-label="Trocar avatar"
                title="Trocar avatar"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            </div>
            <div className="text-xs text-[color:var(--ivory-dim)] leading-relaxed">
              PNG ou JPG, até 4 MB. O avatar é opcional.
            </div>
          </section>

          <section className="space-y-2">
            <label htmlFor="apelido" className="block text-[10px] tracking-[0.22em] uppercase text-[color:var(--ivory-dim)]">
              Nome ou apelido
            </label>
            <input
              id="apelido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={60}
              placeholder="Como você quer aparecer?"
              className="w-full rounded-xl bg-card border border-[color:var(--border)] px-4 py-3 outline-none focus:border-[color:var(--gold)] text-base"
            />
          </section>

          <div className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-6 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={sair} disabled={signingOut} className="h-10 px-5">
              {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sair"}
            </Button>
            <Button onClick={salvarPerfil} disabled={saving} className="h-10 px-5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar conta"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
