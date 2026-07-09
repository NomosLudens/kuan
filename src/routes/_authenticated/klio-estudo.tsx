// Redireciona /klio-estudo para /klio (Modo Fala Klio dentro de Kháris).
// Mantido por compatibilidade com links antigos.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/klio-estudo")({
  beforeLoad: () => {
    throw redirect({ to: "/klio", replace: true });
  },
  component: () => null,
});
