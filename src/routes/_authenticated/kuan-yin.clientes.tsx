import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClients, createClient, updateClient } from "@/lib/kuanyin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan-yin/clientes")({
  component: ClientesPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type ClientRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  notas: string | null;
  status: string;
  linked_user_id?: string | null;
  updated_at: string;
};

function ClientesPage() {
  const list = useServerFn(listClients);
  const create = useServerFn(createClient);
  const update = useServerFn(updateClient);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [editing, setEditing] = useState<Partial<ClientRow> | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await list()) as ClientRow[];
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!editing?.nome?.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    try {
      const payload = {
        nome: editing.nome.trim(),
        telefone: editing.telefone?.trim() || null,
        email: editing.email?.trim() || null,
        notas: editing.notas?.trim() || null,
        linked_user_id: editing.linked_user_id?.trim() || null,
        status: (editing.status as "prospect" | "confirmed" | "archived") ?? "prospect",
      };
      if (editing.id) {
        await update({ data: { id: editing.id, ...payload } });
        toast.success("Cliente atualizado.");
      } else {
        await create({ data: payload });
        toast.success("Cliente criado.");
      }
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="serif text-[color:var(--gold)] text-lg tracking-[0.18em] uppercase">
          Clientes
        </h1>
        <Button size="sm" onClick={() => setEditing({ status: "prospect" })}>
          + Novo cliente
        </Button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/60 p-4 space-y-3">
          <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--ivory-dim)]">
            {editing.id ? "Editar cliente" : "Novo cliente"}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={editing.nome ?? ""}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tel">Telefone</Label>
              <Input
                id="tel"
                value={editing.telefone ?? ""}
                onChange={(e) => setEditing({ ...editing, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={editing.email ?? ""}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="linked-user">ID do usuário vinculado</Label>
              <Input
                id="linked-user"
                value={editing.linked_user_id ?? ""}
                onChange={(e) => setEditing({ ...editing, linked_user_id: e.target.value })}
                placeholder="UUID do cliente com login, se houver"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                rows={3}
                value={editing.notas ?? ""}
                onChange={(e) => setEditing({ ...editing, notas: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={editing.status ?? "prospect"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                className="w-full h-9 rounded-md bg-background border border-[color:var(--border)] px-3 text-sm"
              >
                <option value="prospect">prospecto</option>
                <option value="confirmed">confirmado</option>
                <option value="archived">arquivado</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <p className="text-sm text-[color:var(--ivory-dim)]">Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-[color:var(--ivory-dim)]">
            Nenhum cliente ainda. Cadastre o primeiro pelo botão acima ou peça no chat.
          </p>
        )}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setEditing(r)}
            className="w-full text-left rounded-xl border border-[color:var(--border)] bg-card/40 hover:bg-card/70 px-3 py-2 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-[color:var(--ivory)] truncate">{r.nome}</div>
                <div className="text-[11px] text-[color:var(--ivory-dim)] truncate">
                  {[r.telefone, r.email, r.linked_user_id ? "login vinculado" : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <span className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--ivory-dim)]">
                {r.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
