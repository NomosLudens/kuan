import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useProfile, saveProfile, uploadAvatar, type Gender } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, Dumbbell, Plus, Trash2, Radio } from "lucide-react";

import { ContinuidadeKaline } from "@/components/continuidade-kaline";
import { loadState, saveState, weekFromTemplates } from "@/features/treinos/storage";
import type { TrainingState, TrainingTemplateKey } from "@/features/treinos/types";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function PerfilPage() {
  const { profile, avatarSignedUrl, loading, reload } = useProfile();
  const [nome, setNome] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [training, setTraining] = useState<TrainingState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [buscandoOffline, setBuscandoOffline] = useState(false);
  const [snapshotOffline, setSnapshotOffline] = useState<unknown>(null);

  useEffect(() => {
    if (profile) {
      setNome(profile.display_name ?? "");
      setGender(profile.gender ?? "");
    }
  }, [profile]);

  useEffect(() => {
    setTraining(loadState());
  }, []);

  function persistTraining(next: TrainingState) {
    setTraining(next);
    saveState(next);
  }

  function persistTrainingWithTemplates(next: TrainingState) {
    persistTraining({ ...next, week: weekFromTemplates(next.templates) });
  }

  function updateTemplate(
    key: TrainingTemplateKey,
    updater: (
      template: TrainingState["templates"][TrainingTemplateKey],
    ) => TrainingState["templates"][TrainingTemplateKey],
  ) {
    if (!training) return;
    const templates = { ...training.templates, [key]: updater(training.templates[key]) };
    persistTrainingWithTemplates({ ...training, templates });
  }

  function addTemplateExercise(key: TrainingTemplateKey) {
    updateTemplate(key, (template) => ({
      ...template,
      exercises: [
        ...template.exercises,
        {
          id: crypto.randomUUID(),
          exercise_id: training?.exercises[0]?.id ?? "",
          sets: 3,
          target_reps: 12,
          rest_seconds: 60,
        },
      ],
    }));
  }

  function removeTemplateExercise(key: TrainingTemplateKey, id: string) {
    updateTemplate(key, (template) => ({
      ...template,
      exercises: template.exercises.filter((exercise) => exercise.id !== id),
    }));
  }

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
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function salvarTudo() {
    setSaving(true);
    try {
      await saveProfile({
        display_name: nome.trim() || null,
        gender: gender === "" ? null : gender,
      });
      await reload();
      toast.success("Perfil salvo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function buscarDoOffline() {
    setBuscandoOffline(true);
    setSnapshotOffline(null);
    try {
      const baseUrl = import.meta.env.VITE_KALINE_OFFLINE_LOCAL_URL || "http://127.0.0.1:64113";
      const res = await fetch(`${baseUrl}/bridge/olhar-de-kairos/local-snapshot`);
      if (!res.ok) throw new Error(`Kaline Offline respondeu ${res.status}`);
      const envelope = await res.json();

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const decryptRes = await fetch("/api/bridge/decifrar-snapshot-local", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(envelope),
      });
      if (!decryptRes.ok) throw new Error("Falha ao decifrar o snapshot recebido");
      const { snapshot } = await decryptRes.json();
      setSnapshotOffline(snapshot);
      toast.success("Snapshot do offline carregado para revisão");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Não consegui buscar do offline: ${err.message}`
          : "Não consegui buscar do offline",
      );
    } finally {
      setBuscandoOffline(false);
    }
  }

  const initial = (nome.trim()[0] ?? profile?.display_name?.[0] ?? "K").toUpperCase();

  // ── Seletor de tela inicial (admin-only) ──────────────────────────
  function InitialSurfaceSelector() {
    const [surface, setSurface] = useState<string>("chat");
    const [savingSurface, setSavingSurface] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const loadedRef = useRef(false);

    useEffect(() => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      void (async () => {
        const { getAuthz } = await import("@/lib/use-authz");
        const authz = await getAuthz();
        setIsAdmin(authz.isAdmin);
        if (authz.isAdmin) {
          const { data: u } = await supabase.auth.getUser();
          if (!u.user) return;
          type ProfileRow = { initial_surface: string | null };
          const { data: _profile } = await supabase
            .from("profiles")
            .select("initial_surface")
            .eq("id", u.user.id)
            .maybeSingle();
          const profile = _profile as ProfileRow | null;
          setSurface(profile?.initial_surface ?? "chat");
        }
      })();
    }, []);

    if (!isAdmin) return null;

    async function saveSurface(value: string) {
      setSavingSurface(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { error } = await supabase
          .from("profiles")
          .update({ initial_surface: value })
          .eq("id", u.user.id);
        if (error) throw error;
        setSurface(value);
        toast.success("Preferência salva. A mudança vale na próxima abertura.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao salvar");
      } finally {
        setSavingSurface(false);
      }
    }

    return (
      <div className="flex flex-wrap gap-2">
        {[
          { v: "chat", label: "Chat clássico" },
          { v: "kaline_presente", label: "Kaline Presente" },
        ].map(({ v, label }) => {
          const active = surface === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => saveSurface(v)}
              disabled={savingSurface || active}
              className={
                "px-4 h-10 rounded-full text-xs uppercase tracking-[0.18em] border transition " +
                (active
                  ? "border-[color:var(--gold)] bg-[color:var(--wine)] text-[color:var(--ivory)] cursor-default"
                  : "border-[color:var(--border)] text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)]")
              }
            >
              {savingSurface ? <Loader2 className="w-3 h-3 animate-spin" /> : label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <h1 className="serif text-2xl text-[color:var(--gold)] tracking-[0.18em] uppercase mb-1">
        Perfil
      </h1>
      <p className="text-sm text-[color:var(--ivory-dim)] mb-8">
        Como Kaline e Klio te chamam, e a foto que aparece nas suas mensagens.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[color:var(--ivory-dim)]">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando…
        </div>
      ) : (
        <div className="space-y-8">
          <section className="flex items-center gap-5">
            <div className="relative">
              {avatarSignedUrl ? (
                <img
                  src={avatarSignedUrl}
                  alt="Sua foto"
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
                aria-label="Trocar foto"
                title="Trocar foto"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            </div>
            <div className="text-xs text-[color:var(--ivory-dim)] leading-relaxed">
              PNG ou JPG, até 4 MB. Visível só pra você — ninguém mais usa esse app.
            </div>
          </section>

          <section className="space-y-2">
            <label
              htmlFor="apelido"
              className="block text-[10px] tracking-[0.22em] uppercase text-[color:var(--ivory-dim)]"
            >
              Apelido
            </label>
            <input
              id="apelido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={60}
              placeholder="Como eu te chamo?"
              className="w-full rounded-xl bg-card border border-[color:var(--border)] px-4 py-3 outline-none focus:border-[color:var(--gold)] text-base"
            />
          </section>

          <section className="space-y-2">
            <p className="block text-[10px] tracking-[0.22em] uppercase text-[color:var(--ivory-dim)]">
              Pronome de tratamento
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { v: "feminino", label: "Bem-vinda" },
                  { v: "masculino", label: "Bem-vindo" },
                  { v: "neutro", label: "Bem-vinde" },
                ] as { v: Gender; label: string }[]
              ).map(({ v, label }) => {
                const active = gender === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGender(v)}
                    className={
                      "px-3 h-9 rounded-full text-xs uppercase tracking-[0.18em] border transition " +
                      (active
                        ? "border-[color:var(--gold)] bg-[color:var(--wine)] text-[color:var(--ivory)]"
                        : "border-[color:var(--border)] text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)]")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[color:var(--ivory-dim)] pt-1">
              Define como Kaline e Klio te saúdam no cockpit.
            </p>
          </section>

          <div className="flex justify-end pt-2">
            <Button onClick={salvarTudo} disabled={saving} className="h-10 px-5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>

          <section className="border-t border-[color:var(--border)] pt-8 space-y-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)]">
                Editar modelos do Corpore Sano
              </h2>
            </div>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Atalho legado. A edição principal agora fica em Corpore Sano › Plano.
            </p>
            {training && (
              <div className="space-y-4">
                {(["treinoA", "treinoB", "treinoC", "treinoD"] as TrainingTemplateKey[]).map(
                  (key) => {
                    const template = training.templates[key];
                    return (
                      <article
                        key={key}
                        className="rounded-2xl border border-[color:var(--border)] bg-card/60 p-3 space-y-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_7rem]">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                              Nome
                            </span>
                            <input
                              value={template.name}
                              onChange={(e) =>
                                updateTemplate(key, (t) => ({ ...t, name: e.target.value }))
                              }
                              className="w-full rounded-xl bg-background border border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--gold)]"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                              Uso
                            </span>
                            <select
                              value={template.day ?? ""}
                              onChange={(e) =>
                                updateTemplate(key, (t) => ({
                                  ...t,
                                  day: e.target.value === "" ? null : Number(e.target.value),
                                }))
                              }
                              className="w-full rounded-xl bg-background border border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--gold)]"
                            >
                              <option value="">Livre</option>
                              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
                                <option key={d} value={i}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                              Duração estimada
                            </span>
                            <input
                              type="number"
                              min={10}
                              value={template.estimated_min}
                              onChange={(e) =>
                                updateTemplate(key, (t) => ({
                                  ...t,
                                  estimated_min: Number(e.target.value) || 40,
                                }))
                              }
                              className="w-full rounded-xl bg-background border border-[color:var(--border)] px-3 py-2 outline-none focus:border-[color:var(--gold)]"
                            />
                          </label>
                        </div>

                        <div className="space-y-2">
                          {template.exercises.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_4.25rem_4.25rem_4.5rem_auto] gap-2 items-end"
                            >
                              <label className="space-y-1 min-w-0">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                                  Exercício
                                </span>
                                <select
                                  value={item.exercise_id}
                                  onChange={(e) =>
                                    updateTemplate(key, (t) => ({
                                      ...t,
                                      exercises: t.exercises.map((x) =>
                                        x.id === item.id
                                          ? { ...x, exercise_id: e.target.value }
                                          : x,
                                      ),
                                    }))
                                  }
                                  className="w-full rounded-xl bg-background border border-[color:var(--border)] px-2 py-2 outline-none focus:border-[color:var(--gold)] text-sm"
                                >
                                  {training.exercises.map((exercise) => (
                                    <option key={exercise.id} value={exercise.id}>
                                      {exercise.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {(
                                [
                                  ["sets", "Séries"],
                                  ["target_reps", "Reps"],
                                  ["rest_seconds", "Desc"],
                                ] as const
                              ).map(([field, label]) => (
                                <label key={field} className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                                    {label}
                                  </span>
                                  <input
                                    type="number"
                                    min={field === "rest_seconds" ? 0 : 1}
                                    value={item[field]}
                                    onChange={(e) =>
                                      updateTemplate(key, (t) => ({
                                        ...t,
                                        exercises: t.exercises.map((x) =>
                                          x.id === item.id
                                            ? { ...x, [field]: Number(e.target.value) || 1 }
                                            : x,
                                        ),
                                      }))
                                    }
                                    className="w-full rounded-xl bg-background border border-[color:var(--border)] px-2 py-2 outline-none focus:border-[color:var(--gold)] text-sm"
                                  />
                                </label>
                              ))}
                              <button
                                type="button"
                                onClick={() => removeTemplateExercise(key, item.id)}
                                className="h-10 w-10 rounded-xl border border-[color:var(--border)] grid place-items-center text-[color:var(--ivory-dim)] hover:text-red-400"
                                aria-label="Remover exercício"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addTemplateExercise(key)}
                          className="h-9"
                        >
                          <Plus className="mr-1 h-4 w-4" /> Adicionar exercício
                        </Button>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </section>

          <section className="border-t border-[color:var(--border)] pt-8 space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)]">
                Ponte Kairós
              </h2>
            </div>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Busca, sob demanda, um snapshot pendente que esteja disponível na Kaline Offline
              rodando localmente. O snapshot fica aqui só para revisão — nada é aplicado
              automaticamente.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={buscarDoOffline}
              disabled={buscandoOffline}
              className="h-10 px-5"
            >
              {buscandoOffline ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar do Offline"}
            </Button>
            {snapshotOffline != null && (
              <pre className="text-xs whitespace-pre-wrap rounded-xl border border-[color:var(--border)] bg-card/60 p-3 max-h-80 overflow-auto">
                {JSON.stringify(snapshotOffline, null, 2)}
              </pre>
            )}
          </section>

          <section className="border-t border-[color:var(--border)] pt-8 space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)]">
                Abertura do app
              </h2>
            </div>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Escolha qual tela aparece quando você entra na Kaline.
            </p>
            <InitialSurfaceSelector />
          </section>

          <section className="border-t border-[color:var(--border)] pt-8">
            <ContinuidadeKaline />
          </section>
        </div>
      )}
    </div>
  );
}
