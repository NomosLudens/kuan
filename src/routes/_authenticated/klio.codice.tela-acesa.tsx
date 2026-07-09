import { CodiceMotorShell } from "@/components/CodiceMotorShell";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { useWakeLock } from "@/lib/use-wake-lock";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/klio/codice/tela-acesa")({
  component: CodiceTelaAcesaPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function CodiceTelaAcesaPage() {
  const [active, setActive] = useState(false);
  useWakeLock(active);
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  return (
    <CodiceMotorShell
      title="Tela Acesa"
      description="Rota autenticada para manter a tela acordada durante uma sessão de leitura."
    >
      <div className="rounded-2xl border border-[color:var(--border)] bg-card/70 p-5 text-sm text-[color:var(--ivory-dim)]">
        <p>
          {supported
            ? "Este navegador informa suporte à Wake Lock API."
            : "Este navegador não informa suporte à Wake Lock API; a leitura continua sem travar."}
        </p>
        <Button className="mt-4" onClick={() => setActive((value) => !value)}>
          {active ? "Desligar Tela Acesa" : "Ativar Tela Acesa"}
        </Button>
      </div>
    </CodiceMotorShell>
  );
}
