import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AssistantChat } from "#/components/ai/assistant-chat";
import { AI_CONVERSATIONS, DELETE_AI_CONVERSATION } from "#/graphql/operations";
import { wsTitle } from "#/lib/seo";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// The assistant page: your saved chats on the left, the open chat on the right.

const newId = () => crypto.randomUUID().replace(/-/g, "");

export const Route = createFileRoute("/_authed/w/$slug/assistant")({
	validateSearch: z.object({ c: z.string().max(64).optional() }),
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Assistant") }] }),
	component: AssistantPage,
});

function AssistantPage() {
	const { slug } = Route.useParams();
	const { c } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data, refetch } = useQuery(AI_CONVERSATIONS, { variables: { slug } });
	// the list (and its "2m ago" times) renders in the browser only, so it never mismatches
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const [remove] = useMutation(DELETE_AI_CONVERSATION, {
		refetchQueries: ["AiConversations"],
	});
	// a new chat gets its id up front, so its first message saves under it
	const threadId = c ?? "";
	const open = (id: string) => navigate({ search: { c: id }, replace: !c });
	if (!c) {
		queueMicrotask(() => open(newId()));
		return null;
	}
	const chats = mounted ? (data?.aiConversations ?? []) : [];

	return (
		<div className="ai-layout">
			<aside className="ai-side" aria-label="Saved chats">
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() => open(newId())}
				>
					<span
						className="icon-[solar--pen-new-square-linear] size-3.5"
						aria-hidden="true"
					/>
					New chat
				</button>
				<div className="ai-convos">
					{chats.map((chat) => (
						<div
							key={chat.id}
							className={cn("ai-convo", chat.id === threadId && "on")}
						>
							<button
								type="button"
								className="grow trunc"
								onClick={() => open(chat.id)}
							>
								<span className="trunc">{chat.title}</span>
								<span className="faint">{ago(chat.updatedAt)}</span>
							</button>
							<button
								type="button"
								className="ibtn ibtn-xs"
								aria-label={`Delete “${chat.title}”`}
								data-tip="Delete"
								onClick={() =>
									toast
										.promise(remove({ variables: { slug, id: chat.id } }), {
											loading: "Deleting chat…",
											success: "Chat deleted",
											error: "Couldn't delete the chat",
										})
										.then(() => {
											if (chat.id === threadId) void open(newId());
										})
										.catch(() => {})
								}
							>
								<span
									className="icon-[solar--trash-bin-minimalistic-linear] size-3"
									aria-hidden="true"
								/>
							</button>
						</div>
					))}
				</div>
			</aside>
			<div className="page ai-page">
				{/* a fresh chat per thread, so one conversation never leaks into another */}
				<AssistantChat
					key={threadId}
					slug={slug}
					threadId={threadId}
					onSaved={() => void refetch()}
				/>
			</div>
		</div>
	);
}
