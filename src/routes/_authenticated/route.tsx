import { kalineWordmark } from "@/lib/brand-assets";
import { kalineApple } from "@/lib/brand-assets";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { canAccessPath, getAuthz, getDefaultPathForUser, resolveLegacyPath } from "@/lib/use-authz";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() lê do storage local (sem round-trip de rede), evitando uma
    // chamada à Supabase a cada navegação. A autorização sensível continua
    // validada no servidor a cada chamada de API (requireUser).
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });

    // Carrega permissões e usa o registry central para legados e autorização.
    const authz = await getAuthz();
    const path = location.pathname;

    const legacyTarget = resolveLegacyPath(path);
    if (legacyTarget && legacyTarget !== path) {
      throw redirect({ to: legacyTarget, replace: true });
    }

    if (!canAccessPath(authz, path)) {
      const fallback = getDefaultPathForUser(authz);
      if (fallback !== path) {
        throw redirect({ to: fallback, replace: true });
      }
    }

    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function HeaderBar() {
  const { toggleSidebar } = useSidebar();

  return (
    <header
      className="sticky top-0 z-30 flex min-h-14 items-end gap-2 border-b border-[color:var(--border)] bg-background/70 px-2 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Abrir menu"
        title="Menu"
        className="flex h-14 min-w-0 flex-1 items-center justify-center gap-3 px-3 transition-colors hover:bg-[color:var(--ivory)]/[0.03]"
      >
        <img src={kalineApple.url} alt="" className="h-8 w-8 shrink-0 apple-glow" />
        <img src={kalineWordmark.url} alt="K∧LINE" className="h-4 w-auto" />
      </button>
    </header>
  );
}

function AuthedLayout() {
  const isMobile = useIsMobile();
  return (
    <SidebarProvider defaultOpen={isMobile}>
      <div className="flex h-[100dvh] min-h-[100dvh] w-full">
        <AppSidebar />
        <div className="flex-1 flex min-w-0 flex-col">
          <HeaderBar />
          <main className="min-h-0 flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
