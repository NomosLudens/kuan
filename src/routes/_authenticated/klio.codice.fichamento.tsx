import { CodiceMotorShell } from "@/components/CodiceMotorShell";
import { LegacyLivrosEngine } from "@/components/LegacyLivrosEngine";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/klio/codice/fichamento")({
  component: CodiceFichamentoPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function CodiceFichamentoPage() {
  return (
    <CodiceMotorShell
      title="Fichamento do Códice"
      description="Rota autenticada para gerar fichamentos a partir do motor preservado de resumo."
    >
      <LegacyLivrosEngine />
    </CodiceMotorShell>
  );
}
