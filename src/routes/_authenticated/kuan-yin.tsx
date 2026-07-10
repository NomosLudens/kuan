import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kuan-yin")({
  beforeLoad: () => {
    throw redirect({ to: "/kuan", replace: true });
  },
});
