import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChatView } from "#/components/chat/chat-view";
import { wsTitle } from "#/lib/seo";

export const Route = createFileRoute("/_authed/w/$slug/chat")({
	validateSearch: z.object({ c: z.string().max(16).optional() }),
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Chat") }] }),
	component: ChatPage,
});

function ChatPage() {
	const { slug } = Route.useParams();
	const { c } = Route.useSearch();
	return <ChatView slug={slug} channelId={c} />;
}
