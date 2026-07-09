import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ensureThread } from "@/lib/ensure-thread";

import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

const searchSchema = z.object({
  facet: z.enum(["kaline", "kharis", "kuanyin"]).optional(),
});

export const Route = createFileRoute("/_authenticated/chat/")({
  validateSearch: searchSchema,
  component: ChatIndex,
  beforeLoad: async ({ search }) => {
    const facet = search.facet ?? "kaline";
    const id = await ensureThread(facet);
    if (id) throw redirect({ to: "/chat/$threadId", params: { threadId: id } });
  },
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function ChatIndex() {
  return null;
}
