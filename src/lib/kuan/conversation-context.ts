import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export type KuanRuntimeAudienceContext =
  | {
      audience: "platform_admin";
      actorUserId: string;
      actorDisplayName: string | null;
      selectedGuardianId: string | null;
      selectedBusinessContextId: string | null;
      safetyScope: "platform_admin_private";
    }
  | {
      audience: "guardian_private";
      actorUserId: string;
      actorDisplayName: string | null;
      guardianId: string | null;
      businessContextId: string | null;
      businessName: string | null;
      guardianSlug: string | null;
      safetyScope: "guardian_private";
    }
  | {
      audience: "public_client";
      actorUserId: null;
      guardianId: string;
      businessContextId: string;
      businessName: string | null;
      guardianSlug: string;
      publicThreadId: string | null;
      visitorKey: string | null;
      clientDisplayName: string | null;
      safetyScope: "public_client";
    };

export async function resolveRuntimeAudienceContext(
  supabase: SupabaseClient<Database>,
  params: {
    userId?: string | null;
    guardianId?: string | null;
    guardianSlug?: string | null;
    publicThreadId?: string | null;
    visitorKey?: string | null;
    clientDisplayName?: string | null;
  }
): Promise<KuanRuntimeAudienceContext> {
  // 1. Private (Authenticated) Chat Context
  if (params.userId) {
    const userId = params.userId;

    // Fetch display name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const actorDisplayName = profile?.display_name ?? null;

    // Check if user has admin role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    // Check if user is a linked guardian (operational user_id)
    const { data: guardianRow } = await supabase
      .from("kuanyin_guardians")
      .select("id, business_context_id, public_slug")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Priority: If admin, they are platform_admin by default (even if also a guardian)
    if (isAdmin) {
      return {
        audience: "platform_admin",
        actorUserId: userId,
        actorDisplayName,
        selectedGuardianId: null,
        selectedBusinessContextId: null,
        safetyScope: "platform_admin_private",
      };
    }

    if (guardianRow) {
      // Get business context name
      let businessName: string | null = null;
      if (guardianRow.business_context_id) {
        const { data: biz } = await supabase
          .from("business_contexts")
          .select("nome")
          .eq("id", guardianRow.business_context_id)
          .maybeSingle();
        businessName = biz?.nome ?? null;
      }

      return {
        audience: "guardian_private",
        actorUserId: userId,
        actorDisplayName,
        guardianId: guardianRow.id,
        businessContextId: guardianRow.business_context_id,
        businessName,
        guardianSlug: guardianRow.public_slug,
        safetyScope: "guardian_private",
      };
    }

    // Default authenticated fallback is platform_admin
    return {
      audience: "platform_admin",
      actorUserId: userId,
      actorDisplayName,
      selectedGuardianId: null,
      selectedBusinessContextId: null,
      safetyScope: "platform_admin_private",
    };
  }

  // 2. Public Client Chat Context (No Authenticated User)
  const identifier = params.guardianId || params.guardianSlug;
  if (!identifier) {
    throw new Error("Cannot resolve public client context without guardianId or guardianSlug.");
  }

  // UUID regex to check if identifier is a UUID (guardianId or business_context_id)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let guardian: {
    id: string;
    business_context_id: string;
    public_slug: string;
  } | null = null;

  if (UUID_RE.test(identifier)) {
    const { data } = await supabase
      .from("kuanyin_guardians")
      .select("id, business_context_id, public_slug")
      .or(`id.eq.${identifier},business_context_id.eq.${identifier}`)
      .maybeSingle();
    guardian = data as { id: string; business_context_id: string; public_slug: string } | null;
  } else {
    const { data } = await supabase
      .from("kuanyin_guardians")
      .select("id, business_context_id, public_slug")
      .eq("public_slug", identifier)
      .maybeSingle();
    guardian = data as { id: string; business_context_id: string; public_slug: string } | null;
  }

  if (!guardian) {
    throw new Error(`Guardian not found for identifier: ${identifier}`);
  }

  let businessName: string | null = null;
  if (guardian.business_context_id) {
    const { data: biz } = await supabase
      .from("business_contexts")
      .select("nome")
      .eq("id", guardian.business_context_id)
      .maybeSingle();
    businessName = biz?.nome ?? null;
  }

  return {
    audience: "public_client",
    actorUserId: null,
    guardianId: guardian.id,
    businessContextId: guardian.business_context_id,
    businessName,
    guardianSlug: guardian.public_slug,
    publicThreadId: params.publicThreadId ?? null,
    visitorKey: params.visitorKey ?? null,
    clientDisplayName: params.clientDisplayName ?? null,
    safetyScope: "public_client",
  };
}
