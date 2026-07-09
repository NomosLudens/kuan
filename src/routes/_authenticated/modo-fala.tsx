// Redireciona /modo-fala para /klio (nova experiência voice-first real).
// Mantido por compatibilidade com links antigos.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/modo-fala")({
  beforeLoad: () => {
    throw redirect({ to: "/klio", replace: true });
  },
  component: () => null,
});
