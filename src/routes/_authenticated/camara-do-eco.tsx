// Redireciona /camara-do-eco para /camara (tela real da Câmara de Eco).
// Mantido por compatibilidade com links antigos.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/camara-do-eco")({
  beforeLoad: () => {
    throw redirect({ to: "/camara", replace: true });
  },
  component: () => null,
});
