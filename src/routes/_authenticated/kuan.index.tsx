import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kuan/")({
  beforeLoad: () => {
    throw redirect({ to: "/kuan", replace: true });
  },
});
