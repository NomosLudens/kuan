import { useEffect } from "react";
import { kuanyinApple } from "@/lib/brand-assets";
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { canAccessPath, getAuthz, getDefaultPathForUser, resolveLegacyPath } from "@/lib/use-authz";
import { isAuthSessionError, handleAuthSessionExpiry } from "@/lib/utils";
import { ChevronLeft, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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

    const isUnlinked = !authz.isAdmin && authz.allowedFacets.length === 0;

    if (!isUnlinked && !canAccessPath(authz, path)) {
      const fallback = getDefaultPathForUser(authz);
      if (fallback !== path) {
        throw redirect({ to: fallback, replace: true });
      }
    }

    return { user: data.session.user, isUnlinked };
  },
  component: AuthedLayout,
});

function HeaderBar() {
  const { toggleSidebar } = useSidebar();

  return (
    <header
      className="sticky top-0 z-30 flex min-h-14 items-end gap-2 border-b border-[color:var(--border)] bg-background/70 px-2 pb-2 backdrop-blur"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Abrir menu"
        title="Menu"
        className="flex h-14 min-w-0 flex-1 items-center justify-center gap-3 px-3 transition-colors hover:bg-[color:var(--ivory)]/[0.03]"
      >
        <img src={kuanyinApple.url} alt="" className="h-8 w-8 shrink-0 apple-glow" />
        <span className="serif text-sm uppercase tracking-[0.28em] text-[color:var(--ivory)]">
          Kuan-Yin
        </span>
      </button>
    </header>
  );
}

function KuanMobileSubHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  let title = "Voltar";
  if (path.includes("/agendamentos")) title = "Agenda";
  else if (path.includes("/clientes")) title = "Clientes";
  else if (path.includes("/pedidos")) title = "Pedidos";
  else if (path.includes("/pagamentos")) title = "Pagamentos";
  else if (path.includes("/guardioes")) title = "Guardiões";
  else if (path.includes("/inbox")) title = "Atendimentos";
  else if (path.includes("/showroom")) title = "Showroom";
  else if (path.includes("/revisao")) title = "Revisão";
  else if (path.includes("/config")) title = "Configuração";

  return (
    <header
      className="flex min-h-12 flex-none items-center justify-between border-b border-[color:var(--border)] bg-card/40 px-3 pb-2 backdrop-blur sm:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <Link
        to="/kuan"
        className="flex items-center gap-1.5 text-xs text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)] active:scale-95 transition-transform"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Conversa</span>
      </Link>
      <span className="serif text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">
        {title}
      </span>
      <div className="w-12" /> {/* spacer to balance */}
    </header>
  );
}

function AuthedLayout() {
  const { isUnlinked } = Route.useRouteContext();
  const isMobile = useIsMobile();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isKuan = path.startsWith("/kuan");

  // Monitor window focus/visibility changes to keep session verified and fresh
  useEffect(() => {
    let lastChecked = 0;
    const CHECK_COOLDOWN_MS = 10_000; // Throttle to at most once every 10s

    const verifySessionOnFocus = async () => {
      const now = Date.now();
      if (now - lastChecked < CHECK_COOLDOWN_MS) return;
      lastChecked = now;

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          await handleAuthSessionExpiry();
        }
      } catch (err) {
        await handleAuthSessionExpiry();
      }
    };

    window.addEventListener("focus", verifySessionOnFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifySessionOnFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", verifySessionOnFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (isUnlinked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-4">
        <div className="max-w-md w-full rounded-3xl border border-[color:var(--border)] bg-card/60 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-[color:oklch(0.69_0.22_350/0.12)] p-4 border border-[color:oklch(0.69_0.22_350/0.3)]">
              <ShieldAlert className="h-10 w-10 text-[color:var(--gold)]" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="serif text-2xl text-[color:var(--ivory)]">Acesso Pendente</h1>
            <p className="text-sm leading-relaxed text-[color:var(--ivory-dim)]">
              Sua conta ainda não está vinculada a nenhuma presença comercial de Guardião. Entre em
              contato com o administrador da plataforma para obter um convite e liberar seu acesso.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
              variant="outline"
              className="w-full h-11 rounded-xl hover:bg-[color:var(--ivory)]/[0.05]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No mobile, se for rota Kuan, removemos a sidebar e a HeaderBar global
  // para deixar a experiência chat-first tela cheia.
  const hideSidebarMobile = isMobile && isKuan;

  return (
    <SidebarProvider defaultOpen={isMobile && !hideSidebarMobile}>
      <div className="flex h-[100dvh] min-h-[100dvh] w-full">
        {!hideSidebarMobile && <AppSidebar />}
        <div className="flex flex-1 min-w-0 flex-col">
          {!hideSidebarMobile && <HeaderBar />}
          <main className="flex-1 min-w-0 min-h-0 flex flex-col">
            {hideSidebarMobile && path !== "/kuan" && path !== "/kuan/" && <KuanMobileSubHeader />}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
