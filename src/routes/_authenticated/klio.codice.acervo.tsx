import { CodiceMotorShell } from "@/components/CodiceMotorShell";
import { LegacyLivrosEngine } from "@/components/LegacyLivrosEngine";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/klio/codice/acervo")({
  component: CodiceAcervoPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function CodiceAcervoPage() {
  return (
    <CodiceMotorShell
      title="Acervo do Códice"
      description="Rota autenticada para listar leituras, extrair textos e retomar fichamentos no motor preservado."
    >
      <LegacyLivrosEngine />
    </CodiceMotorShell>
  );
}
