import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { kuanyinApple } from "@/lib/brand-assets";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Store,
  Users,
  ShieldCheck,
  CalendarDays,
  Receipt,
  CreditCard,
  Rocket,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/kuan-yin")({
  component: KuanYinLayout,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

const ADMIN_SCREENS = [
  { to: "/kuan-yin/showroom", label: "Showroom", icon: Store },
  { to: "/kuan-yin/clientes", label: "Clientes", icon: Users },
  { to: "/kuan-yin/guardioes", label: "Guardiões", icon: ShieldCheck },
  { to: "/kuan-yin/agendamentos", label: "Agenda", icon: CalendarDays },
  { to: "/kuan-yin/pedidos", label: "Pedidos", icon: Receipt },
  { to: "/kuan-yin/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/kuan-yin/onboarding", label: "Onboarding", icon: Rocket },
  { to: "/kuan-yin/config", label: "Negócio", icon: Settings },
] as const;

function KuanYinLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isChat = path === "/kuan-yin";
  const activeAdmin = ADMIN_SCREENS.find((s) => path.startsWith(s.to));

  return (
    <div className="flex h-full min-h-[calc(100dvh-3.5rem)] flex-col">
      <header className="border-b border-[color:var(--border)] bg-background/60 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
          <img
            src={kuanyinApple.url}
            alt=""
            className="w-7 h-7 shrink-0"
            style={{ filter: "drop-shadow(0 0 8px rgba(236, 72, 153, 0.45))" }}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <Link
              to="/kuan-yin"
              className="serif block truncate text-[color:oklch(0.86_0.06_350)] text-sm tracking-[0.18em] uppercase hover:opacity-80"
            >
              Kuan-Yin
            </Link>
            <div className="truncate text-[10px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)]">
              {activeAdmin ? activeAdmin.label : "conversa · faceta comercial"}
            </div>
          </div>
          <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {!isChat && (
              <Link
                to="/kuan-yin"
                className="inline-flex h-8 items-center rounded-full border border-[color:var(--border)] px-2.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--ivory-dim)] hover:border-[color:oklch(0.69_0.22_350/0.4)] hover:text-[color:var(--ivory)] sm:px-3 sm:text-[11px] sm:tracking-[0.18em]"
              >
                <span className="sm:hidden">Chat</span>
                <span className="hidden sm:inline">Conversa</span>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    "h-8 gap-1.5 rounded-full px-2.5 text-[10px] uppercase tracking-[0.14em] sm:px-3 sm:text-[11px] sm:tracking-[0.18em] " +
                    (activeAdmin
                      ? "border-[color:oklch(0.69_0.22_350/0.4)] bg-[color:oklch(0.69_0.22_350/0.16)] text-[color:var(--ivory)]"
                      : "border-[color:var(--border)] text-[color:var(--ivory-dim)]")
                  }
                >
                  <LayoutGrid className="size-3.5" />
                  Painéis
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {ADMIN_SCREENS.map((s) => {
                  const Icon = s.icon;
                  const active = path.startsWith(s.to);
                  return (
                    <DropdownMenuItem key={s.to} asChild>
                      <Link
                        to={s.to}
                        className={active ? "bg-accent text-[color:var(--ivory)]" : undefined}
                      >
                        <Icon className="size-4" />
                        {s.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
