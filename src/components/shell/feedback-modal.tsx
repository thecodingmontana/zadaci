import { useMutation } from "@apollo/client/react";
import { type FormEvent, useState } from "react";
import { Modal } from "#/components/q/modal";
import { SEND_FEEDBACK } from "#/graphql/operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Send feedback: a bug, an idea or anything else, straight to the support inbox (replies come to
// the sender's email). Opened from the sidebar and the command menu.

const KINDS = [
	[
		"bug",
		"Bug",
		"icon-[solar--bug-linear]",
		"What happened, and what did you expect?",
	],
	[
		"idea",
		"Idea",
		"icon-[solar--lightbulb-linear]",
		"What would make Zadaci better for you?",
	],
	[
		"other",
		"Other",
		"icon-[solar--chat-round-dots-linear]",
		"Tell us anything.",
	],
] as const;
type Kind = (typeof KINDS)[number][0];

/** "Chrome on Windows": enough to reproduce a bug, without the whole user agent. */
function browserName() {
	const ua = navigator.userAgent;
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /Firefox\//.test(ua)
			? "Firefox"
			: /Chrome\//.test(ua)
				? "Chrome"
				: /Safari\//.test(ua)
					? "Safari"
					: "A browser";
	const os = /Windows/.test(ua)
		? "Windows"
		: /Android/.test(ua)
			? "Android"
			: /iPhone|iPad/.test(ua)
				? "iOS"
				: /Mac OS/.test(ua)
					? "macOS"
					: /Linux/.test(ua)
						? "Linux"
						: "";
	return os ? `${browser} on ${os}` : browser;
}

export function FeedbackModal({
	open,
	onOpenChange,
	slug,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	slug: string;
}) {
	const [kind, setKind] = useState<Kind>("bug");
	const [message, setMessage] = useState("");
	const [send, { loading }] = useMutation(SEND_FEEDBACK);
	const hint = KINDS.find(([k]) => k === kind)?.[3];

	async function submit(e: FormEvent) {
		e.preventDefault();
		try {
			await send({
				variables: {
					kind,
					message,
					slug,
					page: location.pathname,
					browser: browserName(),
				},
			});
			toast.success("Thanks! We read every one.", {
				desc: "If we need more, we'll reply to your email.",
			});
			setMessage("");
			onOpenChange(false);
		} catch (err) {
			toast.error("Couldn't send it", { desc: (err as Error).message });
		}
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="Send feedback"
			sub="Found a bug or have an idea? It goes straight to the people who build Zadaci."
			footer={
				<>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						form="feedback-form"
						className={cn("btn btn-primary", loading && "is-loading")}
						disabled={loading || !message.trim()}
					>
						Send
					</button>
				</>
			}
		>
			<form
				id="feedback-form"
				className="modal-b"
				style={{ display: "flex", flexDirection: "column", gap: 12 }}
				onSubmit={submit}
			>
				<div className="seg">
					{KINDS.map(([k, label, icon]) => (
						<button
							key={k}
							type="button"
							aria-pressed={kind === k}
							className={cn(kind === k && "on")}
							onClick={() => setKind(k)}
						>
							<span className={cn(icon, "size-3.5")} aria-hidden="true" />
							{label}
						</button>
					))}
				</div>
				<textarea
					className="textarea"
					rows={5}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder={hint}
					aria-label="Your feedback"
					maxLength={5000}
					// biome-ignore lint/a11y/noAutofocus: the window opens to write straight away
					autoFocus
				/>
				<p className="faint" style={{ fontSize: 12, margin: 0 }}>
					We include your name, email, this page and your browser, so we can
					follow up.
				</p>
			</form>
		</Modal>
	);
}
