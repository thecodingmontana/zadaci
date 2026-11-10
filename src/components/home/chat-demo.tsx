import { useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { cn } from "#/lib/utils";
import { Stage, useDemoLoop } from "./demo-stage";

// Team chat, drawn with the chat's own classes (src/ui.css .chat-main/.chat-msg/.reacts/.chat-compose):
// someone types, their message lands, a reaction is added, and a message @mentions you (Maya).
// Like the app, new messages simply appear; "is typing…" shows while someone writes.

type Msg = {
	id: string;
	who: string;
	ago: string;
	text: string;
	at?: string;
	react?: [string, number];
};

const MSGS: Msg[] = [
	{
		id: "1",
		who: "Leo Park",
		ago: "9m ago",
		text: "Offline mode is on the beta branch. Lists open with no signal now 🎉",
	},
	{
		id: "2",
		who: "Amara Osei",
		ago: "6m ago",
		text: "Tried it on the subway this morning, works great. @Maya Chen can you look at dark mode on the iPad?",
		at: "@Maya Chen",
	},
	{
		id: "3",
		who: "Maya Chen",
		ago: "2m ago",
		text: "On it. Let's put it in front of beta testers next Tuesday.",
	},
	{
		id: "4",
		who: "Jonas Weber",
		ago: "just now",
		text: "I'll have the release notes and onboarding copy ready by Monday.",
	},
];

function Text({ m }: { m: Msg }) {
	if (!m.at) return <>{m.text}</>;
	const [before, after] = m.text.split(m.at);
	return (
		<>
			{before}
			<span className="chat-at">{m.at}</span>
			{after}
		</>
	);
}

export function ChatDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState(1);
	const [typing, setTyping] = useState<string | null>(null);
	const [reacts, setReacts] = useState<Record<string, [string, number]>>({});

	useDemoLoop(
		stage,
		async (wait) => {
			for (const m of MSGS.slice(1)) {
				await wait(900);
				setTyping(m.who);
				await wait(1500);
				setTyping(null);
				setShown((n) => n + 1);
				if (m.id === "3") {
					await wait(700);
					setReacts((r) => ({ ...r, "1": ["🎉", 3] }));
				}
			}
			await wait(800);
			setReacts((r) => ({ ...r, "4": ["👍", 2] }));
			await wait(4000);
		},
		() => {
			setShown(1);
			setTyping(null);
			setReacts({});
		},
		() => {
			setShown(MSGS.length);
			setReacts({ "1": ["🎉", 3], "4": ["👍", 2] });
		},
	);

	return (
		<Stage
			width={620}
			height={520}
			label="Zadaci team chat: messages arrive in the #mobile channel, one mentions you, others get reactions"
			stageRef={stage}
			fluid
		>
			<section className="chat-main" style={{ height: "100%" }}>
				<header className="chat-h">
					<span className="chat-h-ic">
						<span className="icon-[solar--hashtag-linear] size-4" />
					</span>
					<span className="chat-h-title">
						<b className="trunc">mobile</b>
						<span className="faint chat-h-sub">3 online · 4 members</span>
					</span>
					<span className="sp" />
					<span className="ibtn ibtn-sm">
						<span className="icon-[solar--sidebar-minimalistic-linear] size-4 -scale-x-100" />
					</span>
				</header>
				<div className="chat-msgs" style={{ overflow: "hidden" }}>
					{MSGS.slice(0, shown).map((m) => {
						const r = reacts[m.id];
						return (
							<div
								key={m.id}
								className={cn(
									"chat-msg",
									m.at === "@Maya Chen" && "mentions-me",
								)}
							>
								<div className="chat-av">
									<Av name={m.who} />
								</div>
								<div className="chat-body">
									<div className="chat-meta">
										<b>{m.who}</b>
										<span className="faint">{m.ago}</span>
									</div>
									<div className="chat-text">
										<Text m={m} />
									</div>
									{r && (
										<div className="reacts">
											<span className={cn("react", r[0] === "🎉" && "mine")}>
												{r[0]}
												<span className="num">{r[1]}</span>
											</span>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
				<div className="chat-typing faint">
					{typing ? `${typing} is typing…` : ""}
				</div>
				<div className="chat-compose">
					<textarea
						rows={1}
						readOnly
						tabIndex={-1}
						placeholder="Message #mobile"
					/>
					<div className="chat-compose-tools">
						<span className="btn btn-secondary btn-sm">
							<span className="icon-[solar--paperclip-linear] size-4" />
							<span className="chat-h-label">Add file</span>
						</span>
						<span className="sp" />
						<span
							className="btn btn-primary btn-sm chat-send"
							aria-disabled="true"
						>
							<span className="icon-[solar--arrow-up-linear] size-4" />
						</span>
					</div>
				</div>
			</section>
		</Stage>
	);
}
