import { useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { ConfirmModal } from "#/components/q/confirm";
import { useCloseOnOutsideClick } from "#/components/tasks/drawer";
import { DELETE_AI_CONVERSATION } from "#/graphql/operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { AssistantChat } from "./assistant-chat";
import { useAssistant } from "./assistant-context";

// The assistant lives in a side panel you can open from anywhere (the topbar button or ⌘/Ctrl+J).
// Each person has one chat per workspace; it's kept until they clear it.

export function AssistantPanel({
	slug,
	threadId,
	leaving,
}: {
	slug: string;
	threadId: string;
	/** closed, and sliding out before it unmounts */
	leaving?: boolean;
}) {
	const { setOpen } = useAssistant();
	const [full, setFull] = useState(false);
	const [clearing, setClearing] = useState(false);
	// a new key after clearing gives the chat a fresh, empty start
	const [round, setRound] = useState(0);
	const [clear] = useMutation(DELETE_AI_CONVERSATION);
	const aside = useCloseOnOutsideClick(() => setOpen(false));

	// Esc closes the panel unless something is open on top of it, or you're typing in it
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return;
			if (
				document.querySelector(
					".pop, [role=dialog], aside.drawer:not(.ai-drawer)",
				)
			)
				return;
			if ((e.target as Element | null)?.closest?.(".ai-drawer textarea"))
				return;
			setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [setOpen]);

	return (
		<>
			{full && (
				// biome-ignore lint/a11y/noStaticElementInteractions: the scrim is a mouse shortcut; Esc and the button also shrink it
				// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
				<div
					className="drawer-scrim full enter"
					onClick={() => setFull(false)}
				/>
			)}
			<aside
				ref={aside}
				className={cn(
					"drawer enter ai-drawer",
					full && "full",
					leaving && "leaving",
				)}
				aria-label="Zad"
			>
				<div className="drawer-h">
					<span
						className="icon-[hugeicons--ai-magic] size-4"
						aria-hidden="true"
					/>
					<b style={{ marginLeft: 4 }}>Zad</b>
					<span className="sp" />
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-label="Clear history"
						data-tip="Clear history"
						onClick={() => setClearing(true)}
					>
						<span
							className="icon-[solar--eraser-linear] size-4"
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						className="ibtn ibtn-sm hide-m"
						aria-label={full ? "Back to side panel" : "Expand"}
						data-tip={full ? "Side panel" : "Expand"}
						onClick={() => setFull(!full)}
					>
						<span
							className={cn(
								"size-4",
								full
									? "icon-[solar--minimize-square-linear]"
									: "icon-[solar--maximize-square-linear]",
							)}
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-label="Close"
						data-tip="Close (Esc)"
						onClick={() => setOpen(false)}
					>
						<span
							className="icon-[solar--close-circle-linear] size-4"
							aria-hidden="true"
						/>
					</button>
				</div>
				<AssistantChat key={round} slug={slug} threadId={threadId} />
				<ConfirmModal
					open={clearing}
					onOpenChange={setClearing}
					title="Clear the chat history?"
					body="Every message in this chat is deleted. Changes Zad made to your work stay."
					ok="Clear history"
					danger
					icon="icon-[solar--eraser-linear]"
					onConfirm={() =>
						toast
							.promise(clear({ variables: { slug, id: threadId } }), {
								loading: "Clearing…",
								success: "Chat history cleared",
								error: "Couldn't clear the history",
							})
							.then(() => setRound((r) => r + 1))
							.catch(() => {})
					}
				/>
			</aside>
		</>
	);
}
