import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { writeKuanIntegrityLog } from "@/lib/kuanyin-integrity";

export const listGuardianInboxThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ status: z.enum(["open", "closed", "all"]).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    let query = supabase
      .from("kuanyin_public_chat_threads")
      .select("id, visitor_name, visitor_key, status, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: threads, error } = await query;
    if (error) throw new Error(error.message);

    return threads.map((t) => ({
      id: t.id,
      visitorName: t.visitor_name,
      visitorKeyTail: t.visitor_key ? t.visitor_key.slice(-4) : null,
      status: t.status,
      updatedAt: t.updated_at,
    }));
  });

export const getGuardianInboxThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const { data: thread, error: threadError } = await supabase
      .from("kuanyin_public_chat_threads")
      .select("id, visitor_name, visitor_key, status, updated_at")
      .eq("user_id", userId)
      .eq("id", data.threadId)
      .single();

    if (threadError) throw new Error("Atendimento não encontrado ou indisponível.");

    const { data: messages, error: messagesError } = await supabase
      .from("kuanyin_public_chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    if (messagesError) throw new Error(messagesError.message);

    return {
      thread: {
        id: thread.id,
        visitorName: thread.visitor_name,
        visitorKeyTail: thread.visitor_key ? thread.visitor_key.slice(-4) : null,
        status: thread.status,
        updatedAt: thread.updated_at,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        createdAt: m.created_at,
      })),
    };
  });

export const sendGuardianManualReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        message: z.string().trim().min(1, "Mensagem vazia.").max(3000, "Mensagem muito longa."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Verify ownership
    const { data: thread, error: threadError } = await supabase
      .from("kuanyin_public_chat_threads")
      .select("id, guardian_id, status")
      .eq("user_id", userId)
      .eq("id", data.threadId)
      .single();

    if (threadError) throw new Error("Atendimento não encontrado ou indisponível.");
    if (thread.status === "closed") throw new Error("Reabra o atendimento antes de responder.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert manual message
    const { error: insertError } = await supabaseAdmin.from("kuanyin_public_chat_messages").insert({
      thread_id: thread.id,
      guardian_id: thread.guardian_id,
      user_id: userId,
      role: "kuanyin",
      content: data.message.trim(),
    } as never);

    if (insertError) throw new Error("Não foi possível enviar a resposta agora.");

    // Update thread updatedAt
    await supabaseAdmin
      .from("kuanyin_public_chat_threads")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", thread.id)
      .eq("user_id", userId);

    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      severity: "info",
      note: "guardian manual reply sent",
      excerpt: `thread_id:${thread.id}`,
      threadId: thread.id,
    });

    return { ok: true };
  });

export const setGuardianThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ threadId: z.string().uuid(), status: z.enum(["open", "closed"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const { data: updated, error } = await supabase
      .from("kuanyin_public_chat_threads")
      .update({ status: data.status, updated_at: new Date().toISOString() } as never)
      .eq("user_id", userId)
      .eq("id", data.threadId)
      .select("id, status")
      .single();

    if (error || !updated) throw new Error("Não foi possível atualizar o status.");

    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      severity: "info",
      note: `thread status changed: -> ${data.status}`,
      excerpt: `thread_id:${data.threadId}`,
      threadId: data.threadId,
    });

    return { ok: true, status: updated.status };
  });
