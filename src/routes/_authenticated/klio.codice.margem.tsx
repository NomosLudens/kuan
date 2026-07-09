import { CodiceMotorShell } from "@/components/CodiceMotorShell";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/klio/codice/margem")({
  component: CodiceMargemPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type LivroOption = {
  id: string;
  titulo: string;
  autor: string | null;
};

type Margem = {
  id: string;
  livro_id: string | null;
  trecho: string | null;
  nota: string;
  localizacao: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type FormState = {
  livro_id: string;
  trecho: string;
  nota: string;
  localizacao: string;
  tags: string;
};

const initialForm: FormState = {
  livro_id: "",
  trecho: "",
  nota: "",
  localizacao: "",
  tags: "",
};

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseLocation(value: string): Json {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    return { marcador: trimmed };
  }
}

function stringifyLocation(value: Record<string, unknown>) {
  return Object.keys(value).length ? JSON.stringify(value, null, 2) : "";
}

function CodiceMargemPage() {
  const [livros, setLivros] = useState<LivroOption[]>([]);
  const [margens, setMargens] = useState<Margem[]>([]);
  const [selectedLivroId, setSelectedLivroId] = useState("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedLivro = useMemo(
    () => livros.find((livro) => livro.id === selectedLivroId),
    [livros, selectedLivroId],
  );

  async function loadLivros() {
    const { data, error } = await supabase
      .from("livros")
      .select("id, titulo, autor")
      .order("ultimo_acesso_em", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    setLivros(data ?? []);
  }

  async function loadMargens(livroId = selectedLivroId) {
    let query = supabase
      .from("codice_margens")
      .select("id, livro_id, trecho, nota, localizacao, tags, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (livroId) query = query.eq("livro_id", livroId);

    const { data, error } = await query;
    if (error) throw error;
    setMargens((data ?? []) as Margem[]);
  }

  async function reload(livroId = selectedLivroId) {
    setBusy(true);
    try {
      await Promise.all([loadLivros(), loadMargens(livroId)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar margens");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    const nota = form.nota.trim();
    if (!nota) {
      toast.error("Escreva uma nota para salvar na margem.");
      return;
    }

    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Usuário não autenticado");

      const payload = {
        user_id: userRes.user.id,
        livro_id: form.livro_id || selectedLivroId || null,
        trecho: form.trecho.trim() || null,
        nota,
        localizacao: parseLocation(form.localizacao),
        tags: parseTags(form.tags),
      };

      if (editingId) {
        const { error } = await supabase.from("codice_margens").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Margem atualizada.");
      } else {
        const { error } = await supabase.from("codice_margens").insert(payload);
        if (error) throw error;
        toast.success("Margem salva.");
      }

      setForm({ ...initialForm, livro_id: selectedLivroId });
      setEditingId(null);
      await loadMargens();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar margem");
    } finally {
      setBusy(false);
    }
  }

  function edit(margem: Margem) {
    setEditingId(margem.id);
    setForm({
      livro_id: margem.livro_id ?? "",
      trecho: margem.trecho ?? "",
      nota: margem.nota,
      localizacao: stringifyLocation(margem.localizacao),
      tags: margem.tags.join(", "),
    });
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const { error } = await supabase.from("codice_margens").delete().eq("id", id);
      if (error) throw error;
      toast.success("Margem apagada.");
      await loadMargens();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar margem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CodiceMotorShell
      title="Margem do Códice"
      description="Anotações autenticadas por livro, trecho e localização de leitura."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-[color:var(--border)] bg-card/70 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="serif text-xl text-[color:var(--ivory)]">Nova margem</h2>
              <p className="text-sm text-[color:var(--ivory-dim)]">
                A nota fica no Supabase; o livro original continua no aparelho.
              </p>
            </div>
            {busy && <Loader2 className="h-5 w-5 animate-spin text-[color:var(--gold)]" />}
          </div>

          <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-[color:var(--gold)]">
            Livro
          </label>
          <select
            value={form.livro_id || selectedLivroId}
            onChange={(event) => {
              const livroId = event.target.value;
              setSelectedLivroId(livroId);
              setForm((current) => ({ ...current, livro_id: livroId }));
              void loadMargens(livroId);
            }}
            className="mb-3 h-11 w-full rounded-md border border-[color:var(--border)] bg-background px-3 text-sm text-[color:var(--ivory)]"
          >
            <option value="">Sem livro específico</option>
            {livros.map((livro) => (
              <option key={livro.id} value={livro.id}>
                {livro.titulo}
                {livro.autor ? ` — ${livro.autor}` : ""}
              </option>
            ))}
          </select>

          <Input
            value={form.trecho}
            onChange={(event) => setForm((current) => ({ ...current, trecho: event.target.value }))}
            placeholder="Trecho destacado (opcional)"
            className="mb-3"
          />
          <textarea
            value={form.nota}
            onChange={(event) => setForm((current) => ({ ...current, nota: event.target.value }))}
            placeholder="Escreva sua nota de margem..."
            className="mb-3 min-h-32 w-full rounded-md border border-[color:var(--border)] bg-background p-3 text-sm text-[color:var(--ivory)]"
          />
          <textarea
            value={form.localizacao}
            onChange={(event) =>
              setForm((current) => ({ ...current, localizacao: event.target.value }))
            }
            placeholder='Localização JSON ou texto, ex: {"chapterIndex":1,"offset":240}'
            className="mb-3 min-h-20 w-full rounded-md border border-[color:var(--border)] bg-background p-3 font-mono text-xs text-[color:var(--ivory)]"
          />
          <Input
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="Tags separadas por vírgula"
            className="mb-4"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={busy}>
              {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingId ? "Atualizar margem" : "Salvar margem"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...initialForm, livro_id: selectedLivroId });
                }}
                disabled={busy}
              >
                <X className="mr-2 h-4 w-4" /> Cancelar edição
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-card/70 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="serif text-xl text-[color:var(--ivory)]">
                {selectedLivro ? `Margens de ${selectedLivro.titulo}` : "Todas as margens"}
              </h2>
              <p className="text-sm text-[color:var(--ivory-dim)]">
                {margens.length} nota{margens.length === 1 ? "" : "s"} encontrada
                {margens.length === 1 ? "" : "s"}.
              </p>
            </div>
            <Button variant="outline" onClick={() => reload()} disabled={busy}>
              Recarregar
            </Button>
          </div>

          <div className="space-y-3">
            {margens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--border)] p-5 text-sm text-[color:var(--ivory-dim)]">
                Nenhuma margem ainda. Salve a primeira nota para este livro/trecho.
              </p>
            ) : (
              margens.map((margem) => (
                <article
                  key={margem.id}
                  className="rounded-xl border border-[color:var(--border)] bg-background/50 p-4"
                >
                  {margem.trecho && (
                    <blockquote className="mb-3 border-l-2 border-[color:var(--gold)] pl-3 text-sm italic text-[color:var(--ivory-dim)]">
                      {margem.trecho}
                    </blockquote>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-[color:var(--ivory)]">
                    {margem.nota}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--ivory-dim)]">
                    {margem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[color:var(--border)] px-2 py-1"
                      >
                        {tag}
                      </span>
                    ))}
                    {Object.keys(margem.localizacao).length > 0 && (
                      <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                        {JSON.stringify(margem.localizacao)}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => edit(margem)}
                      disabled={busy}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(margem.id)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Apagar
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </CodiceMotorShell>
  );
}
