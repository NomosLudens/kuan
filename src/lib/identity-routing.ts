export type CanonicalIdentity = "kaline";

export type LegacyAccessFacet = "kaline" | "kharis" | "kuanyin" | "drive" | "klio";

export type LegacySurface =
  | "home"
  | "kaline"
  | "kaline-presente"
  | "kharis"
  | "klio"
  | "codice"
  | "camara-do-eco"
  | "kuanyin"
  | "drive"
  | "jardim"
  | "revisao"
  | "registro-vivo"
  | "admin"
  | "profile"
  | "agenda"
  | "legal"
  | "training";

export const CANONICAL_IDENTITY = "kaline" as const;

export const CANONICAL_IDENTITY_SOURCE_PATH = "viva.md" as const;

export const DEFAULT_AUTHENTICATED_PATH = "/chat" as const;

export const ACTIVE_PUBLIC_APP_IDS = [
  "kaline-chat",
  "kaline-presente",
  "camara-do-eco",
  "agenda",
  "registro-vivo",
  "jardim",
  "revisao",
  "perfil",
  "perfis",
] as const;

export const ARCHIVED_APP_IDS = [
  "home",
  "kharis",
  "klio",
  "modo-fala-klio",
  "codice",
  "kuanyin",
  "kuanyin-public-page",
  "drive",
  "juridico",
  "legislacao",
  "jurisprudencia",
  "corpore-sano",
  "facetas",
  "diagnostico",
] as const;

const LEGACY_ACCESS_FACETS = ["kaline", "kharis", "kuanyin", "drive", "klio"] as const;

export function normalizeAccessFacet(raw: string | null | undefined): LegacyAccessFacet | null {
  return LEGACY_ACCESS_FACETS.includes(raw as LegacyAccessFacet)
    ? (raw as LegacyAccessFacet)
    : null;
}

export function getCanonicalIdentityForAccessFacet(
  _facet: LegacyAccessFacet | null,
): CanonicalIdentity {
  return CANONICAL_IDENTITY;
}

export function getDefaultPathForIdentity(): string {
  return DEFAULT_AUTHENTICATED_PATH;
}

export function getCanonicalPathForAccessFacet(_facet: LegacyAccessFacet | null): string {
  return DEFAULT_AUTHENTICATED_PATH;
}

export function isActivePublicApp(appId: string): boolean {
  return ACTIVE_PUBLIC_APP_IDS.includes(appId as (typeof ACTIVE_PUBLIC_APP_IDS)[number]);
}

export function isArchivedApp(appId: string): boolean {
  return ARCHIVED_APP_IDS.includes(appId as (typeof ARCHIVED_APP_IDS)[number]);
}
