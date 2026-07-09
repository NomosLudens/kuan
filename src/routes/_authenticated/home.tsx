import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Feather, Flower2, Mic, Sparkle, Sprout, UserCircle } from "lucide-react";
import { getHomeApps, useAuthz } from "@/lib/use-authz";
import { groupAppsForNavigation, type AppRegistryItem } from "@/lib/app-registry";
import { useProfile, welcomeGreeting } from "@/lib/use-profile";
import {
  InlineListSkeleton,
  RouteErrorBoundary,
  RouteNotFoundBoundary,
} from "@/components/loading-states";
import { SemaforoPresence } from "@/components/SemaforoPresence";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeCockpit,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

const APP_ICONS: Record<string, typeof Sparkle> = {
  "kaline-chat": Sparkle,
  "kaline-presente": Mic,
  "camara-do-eco": Mic,
  agenda: CalendarDays,
  "registro-vivo": Feather,
  jardim: Flower2,
  revisao: Sprout,
  perfil: UserCircle,
};

function HomeCockpit() {
  const { profile } = useProfile();
  const authz = useAuthz();
  const homeGroups = groupAppsForNavigation(getHomeApps(authz));

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#08080E] text-[#F3EBDD]">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 pb-24 sm:px-6 sm:py-10">
        <header className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#D9A441]">Kaline Clean</p>
          <div className="space-y-2">
            <h1 className="serif text-3xl sm:text-4xl">
              {welcomeGreeting(profile?.gender ?? null)}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[#F3EBDD]/60">
              Uma entrada enxuta para conversar, organizar o dia e cuidar da memória.
            </p>
          </div>
        </header>

        <SemaforoPresence defaultOpen />

        <section className="space-y-6 fade-up" aria-label="Núcleo canônico da Kaline Clean">
          {authz.loading && <InlineListSkeleton rows={4} />}

          {!authz.loading && homeGroups.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#111016] p-5">
              <p className="serif text-xl text-[#F3EBDD]">Nenhuma superfície disponível</p>
              <p className="mt-1 text-sm text-[#F3EBDD]/55">
                Nenhuma superfície canônica disponível para este perfil.
              </p>
            </div>
          )}

          {homeGroups.map((group) => (
            <section key={group.id} className="space-y-3">
              <div>
                <h2 className="serif text-2xl text-[#F3EBDD]">{group.label}</h2>
                <p className="text-xs text-[#F3EBDD]/45">{group.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.apps.map((app) => (
                  <AppHubCard key={app.id} app={app} />
                ))}
              </div>
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}

function AppHubCard({ app }: { app: AppRegistryItem }) {
  const Icon = APP_ICONS[app.id] ?? Sparkle;

  return (
    <Link
      to={app.path as never}
      className="lift-card group flex min-h-32 items-start gap-4 rounded-2xl border border-white/5 bg-[#111016] p-4 transition hover:border-[#C98A65]/45 hover:bg-[#14121A]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C98A65]/20 bg-[#C98A65]/10 text-[#C98A65]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="serif block text-xl leading-tight text-[#F3EBDD]">
          {app.shortLabel ?? app.label}
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-[#F3EBDD]/60">
          {app.homeDescription ?? app.description}
        </span>
        <span className="mt-4 block text-[10px] uppercase tracking-[0.18em] text-[#C98A65] transition group-hover:text-[#D9A441]">
          Abrir
        </span>
      </span>
    </Link>
  );
}
