import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type MemoryDomain = "kaline" | "kharis" | "kuanyin" | "drive" | "memory";
export type MemorySource =
  "chat" | "camara-do-eco" | "codice" | "registro-vivo" | "manual" | "system";
export type MemorySensitivity = "low" | "medium" | "high";
export type MemoryCandidateStatus = "pending" | "approved" | "rejected" | "archived";

const DomainSchema = z.enum(["kaline", "kharis", "kuanyin", "drive", "memory"]);
const SourceSchema = z.enum([
  "chat",
  "camara-do-eco",
  "codice",
  "registro-vivo",
  "manual",
  "system",
]);
const SensitivitySchema = z.enum(["low", "medium", "high"]);
const StatusSchema = z.enum(["pending", "approved", "rejected", "archived"]);

const CandidateInput = z.object({
  domain: DomainSchema.default("memory"),
  source: SourceSchema.default("manual"),
  sourceId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().min(1).max(8000),
  reason: z.string().trim().max(1000).optional(),
  sensitivity: SensitivitySchema.default("medium"),
  metadata: z.record(z.unknown()).optional(),
});

const ListInput = z.object({
  status: StatusSchema.optional().default("pending"),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

const ReviewInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180).optional(),
  content: z.string().trim().min(1).max(8000).optional(),
  domain: DomainSchema.optional(),
  sensitivity: SensitivitySchema.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(16).optional(),
});

const IdInput = z.object({ id: z.string().uuid() });

type CandidateRow = {
  id: string;
  user_id: string;
  domain: MemoryDomain;
  source: MemorySource;
  source_id: string | null;
  title: string;
  content: string;
  reason: string | null;
  sensitivity: MemorySensitivity;
  status: MemoryCandidateStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_memory_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

function sanitizeText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function table(supabase: unknown) {
  return (supabase as SupabaseClient).from("memory_candidates");
}

function normalizeCandidate(row: CandidateRow) {
  return {
    id: row.id,
    userId: row.user_id,
    domain: row.domain,
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    reason: row.reason,
    sensitivity: row.sensitivity,
    status: row.status,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    approvedMemoryId: row.approved_memory_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const createMemoryCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CandidateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await table(context.supabase)
      .insert({
        user_id: context.userId,
        domain: data.domain,
        source: data.source,
        source_id: data.sourceId ?? null,
        title: sanitizeText(data.title),
        content: sanitizeText(data.content),
        reason: data.reason ? sanitizeText(data.reason) : null,
        sensitivity: data.sensitivity,
        metadata: (data.metadata ?? {}) as Json,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeCandidate(row as CandidateRow);
  });

export const listMemoryCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await table(context.supabase)
      .select("*")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as CandidateRow[]).map(normalizeCandidate);
  });

export const approveMemoryCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReviewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: candidate, error: candidateError } = await table(context.supabase)
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (candidateError) throw new Error(candidateError.message);
    if (!candidate) throw new Error("Candidato não encontrado ou já revisado.");

    const row = candidate as CandidateRow;
    const title = sanitizeText(data.title ?? row.title);
    const content = sanitizeText(data.content ?? row.content);
    const domain = data.domain ?? row.domain;
    const sensitivity = data.sensitivity ?? row.sensitivity;
    const tags = data.tags ?? [row.source, domain, sensitivity];

    const { data: memoria, error: memoriaError } = await context.supabase
      .from("jardim_memorias")
      .insert({
        user_id: context.userId,
        title,
        body: content,
        source: row.source,
        source_ref: row.id,
        category: domain,
        tags,
        importance: sensitivity === "high" ? 3 : sensitivity === "low" ? 1 : 2,
        next_review_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (memoriaError) throw new Error(memoriaError.message);

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await table(context.supabase)
      .update({
        title,
        content,
        domain,
        sensitivity,
        status: "approved",
        reviewed_at: now,
        reviewed_by: context.userId,
        approved_memory_id: memoria.id,
      })
      .eq("id", row.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    return { candidate: normalizeCandidate(updated as CandidateRow), memoryId: memoria.id };
  });

export const rejectMemoryCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await table(context.supabase)
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeCandidate(row as CandidateRow);
  });

export const archiveMemoryCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await table(context.supabase)
      .update({
        status: "archived",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeCandidate(row as CandidateRow);
  });
