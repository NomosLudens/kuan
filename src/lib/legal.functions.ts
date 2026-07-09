import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SearchSchema = z.object({
  query: z.string().trim().min(2).max(300),
  document_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(40).optional(),
});

export type LegalSearchResult = {
  documents: Array<{ id: string; title: string; slug: string; kind: string; status: string }>;
  chunks: Array<{
    id: string;
    document_id: string;
    document_title: string;
    document_status: string;
    path: string;
    level: string;
    text: string;
    status: string;
    source_url: string | null;
  }>;
  needs_disambiguation: boolean;
};

export const searchLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof SearchSchema>) => SearchSchema.parse(d))
  .handler(async ({ data, context }): Promise<LegalSearchResult> => {
    const { supabase } = context;
    // Texto seguro para ilike — quem chama já validou tamanho/charset via zod.
    const pattern = `%${data.query.replace(/[%_]/g, "\\$&")}%`;

    let chunkQuery = supabase
      .from("legal_chunks")
      .select("id, document_id, path, level, text, status, source_url")
      .neq("status", "bloqueado")
      .ilike("text", pattern)
      .order("ordinal", { ascending: true })
      .limit(data.limit ?? 20);
    if (data.document_id) chunkQuery = chunkQuery.eq("document_id", data.document_id);

    const { data: chunks, error: ce } = await chunkQuery;
    if (ce) throw new Error(ce.message);

    const docIds = Array.from(new Set((chunks ?? []).map((c) => c.document_id)));
    let documents: LegalSearchResult["documents"] = [];
    if (docIds.length > 0) {
      const { data: docs, error: de } = await supabase
        .from("legal_documents")
        .select("id, title, slug, kind, status")
        .in("id", docIds);
      if (de) throw new Error(de.message);
      documents = docs ?? [];
    }
    const docMap = new Map(documents.map((d) => [d.id, d]));

    return {
      documents,
      chunks: (chunks ?? []).map((c) => {
        const doc = docMap.get(c.document_id);
        return {
          ...c,
          document_title: doc?.title ?? "(documento desconhecido)",
          document_status: doc?.status ?? "desconhecido",
        };
      }),
      needs_disambiguation: documents.length > 1 && !data.document_id,
    };
  });

export const listLegalDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind?: string }) =>
    z.object({ kind: z.string().max(40).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("legal_documents")
      .select("id, title, slug, kind, jurisdicao, ano, numero, status, source_url, updated_at")
      .order("title", { ascending: true });
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const UpsertDocSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum([
    "constituicao",
    "codigo",
    "lei",
    "decreto",
    "sumula",
    "tema",
    "enunciado",
    "outro",
  ]),
  title: z.string().trim().min(1).max(300),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "use apenas letras minúsculas, números e hífen"),
  jurisdicao: z.string().trim().max(40).optional(),
  ano: z.number().int().min(1800).max(2100).nullable().optional(),
  numero: z.string().trim().max(40).optional(),
  status: z.enum(["vigente", "revogado", "em_revisao", "bloqueado"]).optional(),
  source_url: z.string().url().nullable().optional(),
  editorial_notes: z.string().max(2000).nullable().optional(),
});

export const upsertLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof UpsertDocSchema>) => UpsertDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const payload = {
      ...data,
      jurisdicao: data.jurisdicao ?? "federal",
      status: data.status ?? "vigente",
      imported_by: context.userId,
      imported_at: new Date().toISOString(),
    };
    const { data: row, error } = await context.supabase
      .from("legal_documents")
      .upsert(payload, { onConflict: "slug" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const ChunkInput = z.object({
  level: z.enum(["titulo", "capitulo", "secao", "artigo", "paragrafo", "inciso", "alinea"]),
  path: z.string().trim().min(1).max(80),
  ordinal: z.number().int().min(0).max(100000),
  text: z.string().trim().min(1).max(20000),
  status: z
    .enum(["vigente", "revogado", "em_revisao", "bloqueado", "alterado_recentemente"])
    .optional(),
  source_url: z.string().url().nullable().optional(),
});

export const addLegalChunks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { document_id: string; chunks: z.infer<typeof ChunkInput>[]; replace?: boolean }) =>
      z
        .object({
          document_id: z.string().uuid(),
          replace: z.boolean().optional(),
          chunks: z.array(ChunkInput).min(1).max(500),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    if (data.replace) {
      const { error: delErr } = await context.supabase
        .from("legal_chunks")
        .delete()
        .eq("document_id", data.document_id);
      if (delErr) throw new Error(delErr.message);
    }
    const rows = data.chunks.map((c) => ({
      ...c,
      document_id: data.document_id,
      status: c.status ?? "vigente",
    }));
    const { error } = await context.supabase.from("legal_chunks").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const listLegalChunks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { document_id: string; limit?: number }) =>
    z
      .object({
        document_id: z.string().uuid(),
        limit: z.number().int().min(1).max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("legal_chunks")
      .select("*")
      .eq("document_id", data.document_id)
      .order("ordinal", { ascending: true })
      .limit(data.limit ?? 500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
