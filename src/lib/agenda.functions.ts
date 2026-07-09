// Agenda pessoal — CRUD de eventos (compromissos, aulas, reuniões, prazos).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TipoEvento = "compromisso" | "aula" | "reuniao" | "evento" | "prazo" | "outro";

export type AgendaEvento = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoEvento;
  inicio: string;
  fim: string | null;
  local: string | null;
};

const TIPO_EVENTO = z.enum(["compromisso", "aula", "reuniao", "evento", "prazo", "outro"]);

const ListarEventosInput = z.object({
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }),
});

export const listarEventosAgenda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListarEventosInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("eventos")
      .select("id, titulo, descricao, tipo, inicio, fim, local")
      .eq("user_id", context.userId)
      .gte("inicio", data.inicio)
      .lt("inicio", data.fim)
      .order("inicio", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AgendaEvento[];
  });

const EventoFields = {
  titulo: z.string().trim().min(1).max(160),
  tipo: TIPO_EVENTO,
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }).nullable().optional(),
  local: z.string().trim().max(200).nullable().optional(),
  descricao: z.string().trim().max(4000).nullable().optional(),
};

const CriarEventoInput = z.object(EventoFields);

export const criarEventoAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarEventoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("eventos")
      .insert({
        user_id: context.userId,
        titulo: data.titulo,
        tipo: data.tipo,
        inicio: data.inicio,
        fim: data.fim ?? null,
        local: data.local ?? null,
        descricao: data.descricao ?? null,
      })
      .select("id, titulo, descricao, tipo, inicio, fim, local")
      .single();
    if (error) throw new Error(error.message);
    return row as AgendaEvento;
  });

const AtualizarEventoInput = z.object({ id: z.string().uuid(), ...EventoFields });

export const atualizarEventoAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AtualizarEventoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const { data: row, error } = await context.supabase
      .from("eventos")
      .update({
        titulo: fields.titulo,
        tipo: fields.tipo,
        inicio: fields.inicio,
        fim: fields.fim ?? null,
        local: fields.local ?? null,
        descricao: fields.descricao ?? null,
      })
      .eq("id", id)
      .eq("user_id", context.userId)
      .select("id, titulo, descricao, tipo, inicio, fim, local")
      .single();
    if (error) throw new Error(error.message);
    return row as AgendaEvento;
  });

const EventoIdInput = z.object({ id: z.string().uuid() });

export const deletarEventoAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventoIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("eventos")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
