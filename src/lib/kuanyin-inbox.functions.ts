import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listGuardianInboxThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { status?: "open" | "closed" | "all" }) => d)
  .handler(async ({ data, context }) => {
    const { user, supabase } = context;
    let query = supabase
      .from("kuanyin_public_chat_threads")
      .select("id, visitor_name, visitor_key, status, updated_at")
      .eq("user_id", user.id)
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
  .validator((d: { threadId: string }) => d)
  .handler(async ({ data, context }) => {
    const { user, supabase } = context;

    const { data: thread, error: threadError } = await supabase
      .from("kuanyin_public_chat_threads")
      .select("id, visitor_name, visitor_key, status, updated_at")
      .eq("user_id", user.id)
      .eq("id", data.threadId)
      .single();

    if (threadError) throw new Error("Atendimento não encontrado ou indisponível.");

    const { data: messages, error: messagesError } = await supabase
      .from("kuanyin_public_chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
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
  .validator((d: { threadId: string; message: string }) => {
    if (!d.message.trim()) throw new Error("Mensagem vazia.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { user, supabase } = context;

    // Verify ownership
    const { data: thread, error: threadError } = await supabase
      .from("kuanyin_public_chat_threads")
      .select("id, guardian_id")
      .eq("user_id", user.id)
      .eq("id", data.threadId)
      .single();

    if (threadError) throw new Error("Atendimento não encontrado ou indisponível.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert manual message
    const { error: insertError } = await supabaseAdmin.from("kuanyin_public_chat_messages").insert({
      thread_id: thread.id,
      guardian_id: thread.guardian_id,
      user_id: user.id,
      role: "kuanyin",
      content: data.message.trim(),
    } as never);

    if (insertError) throw new Error("Não foi possível enviar a resposta agora.");

    // Update thread updatedAt
    await supabaseAdmin
      .from("kuanyin_public_chat_threads")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", thread.id);

    return { ok: true };
  });

export const setGuardianThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { threadId: string; status: "open" | "closed" }) => d)
  .handler(async ({ data, context }) => {
    const { user, supabase } = context;

    const { error } = await supabase
      .from("kuanyin_public_chat_threads")
      .update({ status: data.status, updated_at: new Date().toISOString() } as never)
      .eq("user_id", user.id)
      .eq("id", data.threadId);

    if (error) throw new Error("Não foi possível atualizar o status.");

    return { ok: true };
  });
