import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============== VEHICLES ==============
const VehicleCreate = z.object({
  apelido: z.string().trim().min(1).max(80),
  modelo: z.string().trim().max(120).optional().nullable(),
  ano: z.number().int().min(1900).max(2100).optional().nullable(),
  placa: z.string().trim().max(10).optional().nullable(),
  foto_url: z.string().url().max(800).optional().nullable(),
});
export type VehicleCreateInput = z.infer<typeof VehicleCreate>;

export const listVehicles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drive_vehicles")
      .select("*")
      .order("ativo", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type Vehicle = Awaited<ReturnType<typeof listVehicles>>[number];

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof VehicleCreate>) => VehicleCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("drive_vehicles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    const isFirst = (count ?? 0) === 0;
    const { data: row, error } = await supabase
      .from("drive_vehicles")
      .insert({ user_id: userId, ativo: isFirst, ...data })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setActiveVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("drive_vehicles").update({ ativo: false }).eq("user_id", userId);
    const { error } = await supabase
      .from("drive_vehicles")
      .update({ ativo: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drive_vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== REFUELS ==============
const RefuelCreate = z.object({
  vehicle_id: z.string().uuid(),
  km: z.number().int().min(0),
  litros: z.number().positive(),
  combustivel: z.enum(["gasolina", "alcool", "diesel", "gnv", "flex"]).default("gasolina"),
  preco_litro: z.number().positive().optional().nullable(),
  total: z.number().positive().optional().nullable(),
  posto: z.string().trim().max(120).optional().nullable(),
  observacao: z.string().trim().max(400).optional().nullable(),
  ocorrido_em: z.string().datetime().optional(),
});
export type RefuelCreateInput = z.infer<typeof RefuelCreate>;

export const listRefuels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vehicle_id?: string; limit?: number }) =>
    z
      .object({
        vehicle_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("drive_refuels")
      .select("*")
      .order("ocorrido_em", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.vehicle_id) q = q.eq("vehicle_id", data.vehicle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createRefuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RefuelCreate>) => RefuelCreate.parse(d))
  .handler(async ({ data, context }) => {
    const total =
      data.total ?? (data.preco_litro ? Number((data.preco_litro * data.litros).toFixed(2)) : null);
    const { data: row, error } = await context.supabase
      .from("drive_refuels")
      .insert({
        user_id: context.userId,
        ...data,
        total,
        ocorrido_em: data.ocorrido_em ?? new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteRefuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drive_refuels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== OIL ==============
const OilCreate = z.object({
  vehicle_id: z.string().uuid(),
  km: z.number().int().min(0),
  durabilidade_km: z.number().int().min(500).max(50000).default(10000),
  tipo_oleo: z.string().trim().max(80).optional().nullable(),
  observacao: z.string().trim().max(400).optional().nullable(),
  ocorrido_em: z.string().datetime().optional(),
});
export type OilCreateInput = z.infer<typeof OilCreate>;

export const listOilChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vehicle_id?: string }) =>
    z.object({ vehicle_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("drive_oil_changes")
      .select("*")
      .order("ocorrido_em", { ascending: false })
      .limit(50);
    if (data.vehicle_id) q = q.eq("vehicle_id", data.vehicle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createOilChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof OilCreate>) => OilCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("drive_oil_changes")
      .insert({
        user_id: context.userId,
        ...data,
        ocorrido_em: data.ocorrido_em ?? new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOilChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drive_oil_changes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== EXPENSES ==============
const ExpenseCreate = z.object({
  vehicle_id: z.string().uuid().optional().nullable(),
  categoria: z.string().trim().min(1).max(60),
  valor: z.number().positive(),
  descricao: z.string().trim().max(400).optional().nullable(),
  ocorrido_em: z.string().datetime().optional(),
});
export type ExpenseCreateInput = z.infer<typeof ExpenseCreate>;

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vehicle_id?: string; limit?: number }) =>
    z
      .object({
        vehicle_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("drive_expenses")
      .select("*")
      .order("ocorrido_em", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.vehicle_id) q = q.eq("vehicle_id", data.vehicle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof ExpenseCreate>) => ExpenseCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("drive_expenses")
      .insert({
        user_id: context.userId,
        ...data,
        ocorrido_em: data.ocorrido_em ?? new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drive_expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== TRIPS ==============
const TripStart = z.object({
  vehicle_id: z.string().uuid(),
  destino: z.string().trim().max(200).optional().nullable(),
  km_inicial: z.number().int().min(0),
});
export type TripStartInput = z.infer<typeof TripStart>;
const TripEnd = z.object({
  id: z.string().uuid(),
  km_final: z.number().int().min(0),
  pedagio: z.number().min(0).optional().nullable(),
  observacao: z.string().trim().max(400).optional().nullable(),
});
export type TripEndInput = z.infer<typeof TripEnd>;

export const listTrips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vehicle_id?: string }) =>
    z.object({ vehicle_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("drive_trips")
      .select("*")
      .order("iniciado_em", { ascending: false })
      .limit(50);
    if (data.vehicle_id) q = q.eq("vehicle_id", data.vehicle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export type Trip = Awaited<ReturnType<typeof listTrips>>[number];

export const startTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof TripStart>) => TripStart.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("drive_trips")
      .insert({ user_id: context.userId, ...data, iniciado_em: new Date().toISOString() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof TripEnd>) => TripEnd.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("drive_trips")
      .update({ ...rest, finalizado_em: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drive_trips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== DOCS ==============
const DocCreate = z.object({
  vehicle_id: z.string().uuid(),
  tipo: z.string().trim().min(1).max(60),
  vence_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: z.string().trim().max(400).optional().nullable(),
});
export type DocCreateInput = z.infer<typeof DocCreate>;

export const listDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vehicle_id?: string }) =>
    z.object({ vehicle_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("drive_docs")
      .select("*")
      .order("vence_em", { ascending: true })
      .limit(100);
    if (data.vehicle_id) q = q.eq("vehicle_id", data.vehicle_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof DocCreate>) => DocCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("drive_docs")
      .insert({ user_id: context.userId, ...data })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drive_docs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
