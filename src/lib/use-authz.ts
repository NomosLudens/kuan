// Hook de autorização — unifica role, assigned_facet e permissões de acesso.
// FacetSlug permanece como alias de compatibilidade: agora representa permissão de acesso, não faceta técnica de motor.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AUTHENTICATED_PATH,
  getCanonicalPathForAccessFacet,
  normalizeAccessFacet,
  isArchivedApp,
} from "@/lib/identity-routing";
import {
  APP_REGISTRY,
  getAppByPath,
  getHomeRegistryApps,
  getSidebarRegistryApps,
  isAppVisible,
  resolveLegacyPath,
  type AccessFacet,
  type AppRegistryItem,
  type AppRole,
  type EngineFacet,
} from "@/lib/app-registry";

export type FacetSlug = AccessFacet;
export type { AccessFacet, AppRegistryItem };

export type AuthzUser = {
  role: AppRole | null;
  assignedFacet: AccessFacet | null;
  isAdmin: boolean;
  allowedFacets: AccessFacet[];
};

export type AuthzState = AuthzUser & { loading: boolean };

const ALL_FACETS: AccessFacet[] = ["kaline", "kharis", "kuanyin", "drive", "klio"];

function normalizeRole(raw: string | null | undefined): AppRole {
  return raw === "admin" || raw === "guardian" || raw === "user" ? raw : "user";
}

export function getEngineFacetForAccessFacet(facet: AccessFacet | null): EngineFacet | null {
  switch (facet) {
    case "klio":
    case "kharis":
      return "kharis";
    case "kaline":
      return "kaline";
    case "kuanyin":
      return "kuanyin";
    default:
      return null;
  }
}

export function canAccessApp(user: AuthzUser | AuthzState, app: AppRegistryItem): boolean {
  if (app.status === "hidden") return false;
  if (user.isAdmin) return true;
  if (app.status === "planned") return false;
  if (app.adminOnly) return false;
  if (app.allowedRoles?.length && (!user.role || !app.allowedRoles.includes(user.role)))
    return false;
  if (!app.allowedFacets?.length) return true;
  return user.allowedFacets.some((facet) => app.allowedFacets?.includes(facet));
}

export function canAccessPath(user: AuthzUser | AuthzState, path: string): boolean {
  const target = resolveLegacyPath(path) ?? path;
  const app = getAppByPath(target);

  // Rotas autenticadas ainda não catalogadas continuam acessíveis só para admin.
  if (!app) return user.isAdmin;

  // Kaline Clean: app arquivado não abre nem por URL direta.
  if (isArchivedApp(app.id)) return false;

  return canAccessApp(user, app);
}

export function getAllowedApps(user: AuthzUser | AuthzState): AppRegistryItem[] {
  return APP_REGISTRY.filter((app) => isAppVisible(app) && canAccessApp(user, app));
}

export function getSidebarApps(user: AuthzUser | AuthzState): AppRegistryItem[] {
  return getSidebarRegistryApps().filter((app) => canAccessApp(user, app));
}

export function getHomeApps(user: AuthzUser | AuthzState): AppRegistryItem[] {
  return getHomeRegistryApps().filter((app) => canAccessApp(user, app));
}

export function getDefaultPathForUser(_user: AuthzUser | AuthzState): string {
  return DEFAULT_AUTHENTICATED_PATH;
}

export { normalizeAccessFacet, resolveLegacyPath };

function buildState(
  roleRaw: string | null | undefined,
  facetRaw: string | null | undefined,
): AuthzState {
  const role = normalizeRole(roleRaw);
  const assignedFacet = normalizeAccessFacet(facetRaw);
  const isAdmin = role === "admin";
  const allowedFacets = isAdmin ? ALL_FACETS : assignedFacet ? [assignedFacet] : [];
  return { role, assignedFacet, isAdmin, allowedFacets, loading: false };
}

const EMPTY_AUTHZ: AuthzState = {
  role: null,
  assignedFacet: null,
  isAdmin: false,
  allowedFacets: [],
  loading: false,
};

// Cache de módulo: o perfil (role/assigned_facet) é buscado uma única vez por
// sessão de página e compartilhado entre getAuthz() (beforeLoad de rotas) e
// useAuthz() (sidebar/home). getSession() lê do storage local — sem round-trip
// de rede; a única ida à rede é a query em `profiles`, e só na primeira
// chamada. O cache se auto-invalida quando o usuário da sessão muda (login/
// logout), comparando o user.id atual com o cacheado. A autorização sensível
// continua validada no servidor a cada chamada de API (requireSupabaseAuth);
// este estado só decide navegação e menus.
let authzCache: { userId: string; promise: Promise<AuthzState> } | null = null;

async function loadAuthz(): Promise<AuthzState> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    authzCache = null;
    return EMPTY_AUTHZ;
  }
  if (authzCache && authzCache.userId === user.id) return authzCache.promise;

  const promise = (async () => {
    type ProfileRow = { role: string | null; assigned_facet: string | null };
    const { data: _profile } = await supabase
      .from("profiles")
      .select("role, assigned_facet")
      .eq("id", user.id)
      .maybeSingle();
    const profile = _profile as ProfileRow | null;
    return buildState(profile?.role, profile?.assigned_facet);
  })();
  authzCache = { userId: user.id, promise };
  // Falha de rede não deve ficar cacheada — a próxima chamada tenta de novo.
  promise.catch(() => {
    if (authzCache?.promise === promise) authzCache = null;
  });
  return promise;
}

export function useAuthz(): AuthzState {
  const [state, setState] = useState<AuthzState>({
    role: null,
    assignedFacet: null,
    isAdmin: false,
    allowedFacets: [],
    loading: true,
  });
  const load = useCallback(async () => {
    try {
      setState(await loadAuthz());
    } catch {
      setState(EMPTY_AUTHZ);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return state;
}

export async function getAuthz(): Promise<AuthzState> {
  return loadAuthz();
}

export function getChatRouteForFacet(facet: FacetSlug | null): string {
  return getCanonicalPathForAccessFacet(facet);
}
