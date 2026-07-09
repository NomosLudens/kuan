import { CodiceMotorShell } from "@/components/CodiceMotorShell";
import { LegacyLivrosEngine } from "@/components/LegacyLivrosEngine";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/klio/codice/subir")({
  component: CodiceSubirPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function CodiceSubirPage() {
  return (
    <CodiceMotorShell
      title="Subir ao Códice"
      description="Rota autenticada para acionar o motor preservado de upload, extração e armazenamento."
    >
      <LegacyLivrosEngine />
    </CodiceMotorShell>
  );
}
