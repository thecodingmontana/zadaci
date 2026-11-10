import { useRef, useState } from "react";
import {
	ItemList,
	itemsOf,
	MessageText,
	ThinkingCard,
} from "#/components/ai/assistant-parts";
import { Stage, useDemoLoop } from "./demo-stage";

// Zad's side panel, built from the assistant's own parts (ThinkingCard, MessageText, ItemList)
// and classes (.drawer.ai-drawer, .ai-chat …): a question is typed and sent, the steps run with
// their chips, the answer streams in, then "Worked for 3s".

const QUESTION = "What's still blocking the mobile release?";
const ANSWER =
	"One task is still open on the critical path: **MA-5 Sync conflicts when two people edit** (urgent, Leo Park, due Friday). **MA-10 Beta feedback round two** is waiting on it.\n\nEverything else for Mobile app 2.0 is in progress or in review. Want me to move the beta feedback round to next Tuesday?";

const BLOCKERS = {
	tasks: [
		{
			id: "5",
			key: "MA-5",
			title: "Sync conflicts when two people edit",
			status: "To Do",
			project: "Mobile app 2.0",
		},
		{
			id: "10",
			key: "MA-10",
			title: "Beta feedback round two",
			status: "To Do",
			project: "Mobile app 2.0",
		},
		{
			id: "1",
			key: "MA-1",
			title: "Offline mode for task lists",
			status: "In Progress",
			project: "Mobile app 2.0",
		},
	],
};
const CALLS = [
	{
		name: "listProjects",
		input: "{}",
		output: JSON.stringify({
			projects: [{ id: "p", title: "Mobile app 2.0", color: "violet" }],
		}),
	},
	{
		name: "listTasks",
		input: JSON.stringify({ project: "Mobile app 2.0" }),
		output: JSON.stringify(BLOCKERS),
	},
];
type Call = { name: string; input: string; output?: string };

const noop = () => {};

export function ZadDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState("");
	const [asked, setAsked] = useState(false);
	const [calls, setCalls] = useState<Call[]>([]);
	const [chars, setChars] = useState(0);
	const [live, setLive] = useState(false);
	const [startedAt, setStartedAt] = useState<number>();
	const [round, setRound] = useState(0);

	useDemoLoop(
		stage,
		async (wait) => {
			await wait(700);
			for (let i = 1; i <= QUESTION.length; i++) {
				await wait(38);
				setDraft(QUESTION.slice(0, i));
			}
			await wait(400);
			setDraft("");
			setAsked(true);
			setLive(true);
			setStartedAt(Date.now());
			await wait(900); // "Thinking…" before the first step
			for (const call of CALLS) {
				setCalls((cs) => [...cs, { name: call.name, input: call.input }]);
				await wait(1100);
				setCalls((cs) => cs.map((c) => (c.name === call.name ? call : c)));
				await wait(250);
			}
			// the answer arrives in chunks, a few words at a time
			for (let n = 0; n < ANSWER.length; ) {
				n = Math.min(ANSWER.length, n + 6 + Math.floor(Math.random() * 10));
				setChars(n);
				await wait(55);
			}
			setLive(false);
			await wait(5200);
		},
		() => {
			setDraft("");
			setAsked(false);
			setCalls([]);
			setChars(0);
			setLive(false);
			setRound((r) => r + 1);
		},
		() => {
			setAsked(true);
			setCalls(CALLS);
			setChars(ANSWER.length);
			setLive(false);
		},
	);

	const text = ANSWER.slice(0, chars);
	return (
		<Stage
			width={560}
			height={600}
			label="Zad, the Zadaci assistant, answering what's blocking a release"
			stageRef={stage}
			fluid
		>
			<aside
				key={round}
				className="drawer enter ai-drawer"
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					zIndex: 1,
					boxShadow: "none",
					borderLeft: 0,
				}}
			>
				<div className="drawer-h">
					<span className="icon-[hugeicons--ai-magic] size-4" />
					<b style={{ marginLeft: 4 }}>Zad</b>
					<span className="sp" />
					<span className="ibtn ibtn-sm">
						<span className="icon-[solar--eraser-linear] size-4" />
					</span>
					<span className="ibtn ibtn-sm">
						<span className="icon-[solar--maximize-square-linear] size-4" />
					</span>
					<span className="ibtn ibtn-sm">
						<span className="icon-[solar--close-circle-linear] size-4" />
					</span>
				</div>
				<div className="ai-chat">
					<div className="ai-msgs">
						{asked && (
							<div className="ai-msg me">
								<MessageText text={QUESTION} onOpen={noop} />
							</div>
						)}
						{asked && calls.length === 0 && (
							<div className="ai-thinking">
								<span className="shim on">Thinking…</span>
							</div>
						)}
						{calls.length > 0 && (
							<div className="ai-msg bot">
								<ThinkingCard
									calls={calls}
									live={live}
									startedAt={startedAt}
									seconds={3}
									onOpen={noop}
								/>
								{text && <MessageText text={text} onOpen={noop} />}
								{!live && (
									<ItemList
										items={calls
											.filter((c) => c.output)
											.flatMap(itemsOf)
											.filter((i) => i.kind === "task")}
										onOpen={noop}
									/>
								)}
								{!live && text && (
									<div className="ai-acts">
										<span className="ibtn ibtn-xs">
											<span className="icon-[solar--copy-linear] size-3.5" />
										</span>
										<span className="ibtn ibtn-xs">
											<span className="icon-[solar--restart-linear] size-3.5" />
										</span>
									</div>
								)}
							</div>
						)}
					</div>
					<div className="ai-input">
						<textarea
							value={draft}
							rows={2}
							readOnly
							tabIndex={-1}
							placeholder="Ask Zad, or type @ to mention a project, task or note…"
						/>
						<div className="row">
							<span className="ibtn ibtn-sm">
								<span className="icon-[solar--mention-circle-linear] size-4" />
							</span>
							<span className="sp" />
							{live ? (
								<span className="btn btn-secondary btn-sm">Stop</span>
							) : (
								<span
									className="btn btn-primary btn-sm"
									aria-disabled={!draft.trim()}
								>
									Send
								</span>
							)}
						</div>
					</div>
					<p className="faint ai-note" />
				</div>
			</aside>
		</Stage>
	);
}
