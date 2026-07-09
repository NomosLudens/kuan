import { redirect, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/livros")({
  beforeLoad: () => {
    throw redirect({ to: "/klio/codice", replace: true });
  },
});
