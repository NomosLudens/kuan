import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/treinos")({
  beforeLoad: () => {
    throw redirect({ to: "/corpore-sano", replace: true });
  },
  component: () => null,
});
