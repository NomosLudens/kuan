import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChatView } from "@/components/ChatView";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

const searchSchema = z.object({
  seed: z.string().optional(),
  facet: z.string().optional(),
  domain: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatPage,
  validateSearch: searchSchema,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  return <ChatView threadId={threadId} />;
}
