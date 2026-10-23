import { createFileRoute } from "@tanstack/react-router";
import { AssistantChat } from "#/components/ai/assistant-chat";
import { wsTitle } from "#/lib/seo";

// The assistant page: chat with an AI that can look things up and change them for you.

export const Route = createFileRoute("/_authed/w/$slug/assistant")({
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Assistant") }] }),
	component: AssistantPage,
});

function AssistantPage() {
	const { slug } = Route.useParams();
	return (
		<div className="page ai-page">
			<AssistantChat slug={slug} />
		</div>
	);
}
