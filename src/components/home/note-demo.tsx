import { useRef, useState } from "react";
import { Stage, spot, useDemoLoop } from "./demo-stage";
import {
	CURSOR_PRESS_MS,
	CURSOR_TRAVEL_S,
	type Cursor,
	PlayerCursor,
} from "./multiplayer-text";

// A note page with the editor's own classes (src/notes.css .note-page/.note-title/.note-body):
// a teammate's cursor goes to the timeline and types a new line into it.

const AMARA = { name: "Amara Osei", color: "#f0883e" };
const LINE = "Feb 6: first update after launch";

export function NoteDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [cursor, setCursor] = useState<Cursor | null>(null);
	const [pressing, setPressing] = useState(false);
	const [typed, setTyped] = useState<string | null>(null);

	const reduce = useDemoLoop(
		stage,
		async (wait) => {
			await wait(900);
			const r = spot(
				stage.current,
				stage.current?.querySelector("[data-last]"),
			);
			if (!r) return;
			setCursor({ x: r.x + r.w + 4 - 11, y: r.y + r.h - 2, rot: -6 });
			await wait(CURSOR_TRAVEL_S * 1000 + 100);
			setPressing(true);
			await wait(CURSOR_PRESS_MS);
			setPressing(false);
			setTyped("");
			setCursor((c) => c && { ...c, y: c.y + 26, x: c.x + 60 });
			for (let i = 1; i <= LINE.length; i++) {
				await wait(55);
				setTyped(LINE.slice(0, i));
			}
			await wait(2800);
			setCursor(null);
			await wait(1200);
		},
		() => {
			setTyped(null);
			setPressing(false);
		},
		() => {
			setTyped(LINE);
			setCursor(null);
		},
	);

	return (
		<Stage
			width={620}
			height={560}
			label="A Zadaci note, Mobile 2.0 launch plan, with a teammate adding a line to its timeline"
			stageRef={stage}
			fluid
		>
			<div
				className="note-page"
				style={{ padding: "32px 28px 0", maxWidth: "none" }}
			>
				<span className="note-icon" style={{ display: "inline-block" }}>
					🚀
				</span>
				<textarea
					className="note-title"
					rows={1}
					readOnly
					tabIndex={-1}
					value="Mobile 2.0 launch plan"
				/>
				<div className="note-body">
					<div className="tiptap" style={{ minHeight: 0 }}>
						<p>
							Everything we need to ship the new app by the end of January, in
							one place.
						</p>
						<h2>Timeline</h2>
						<ul>
							<li>
								<p>Nov 18: offline mode in beta</p>
							</li>
							<li>
								<p>Dec 9: public beta on TestFlight</p>
							</li>
							<li>
								<p>
									<span data-last>Jan 30: release in both stores</span>
								</p>
							</li>
							{typed !== null && (
								<li>
									<p>
										{typed}
										{!reduce && cursor && (
											<span className="inline-block h-[1.15em] w-px translate-y-[3px] bg-(--q-text)" />
										)}
									</p>
								</li>
							)}
						</ul>
						<h2>Open questions</h2>
						<p>
							Do we keep the old widget for a release, or replace it straight
							away?
						</p>
					</div>
				</div>
			</div>
			<div className="pointer-events-none absolute inset-0">
				<PlayerCursor
					player={AMARA}
					cursor={cursor}
					pressing={pressing}
					reduce={reduce}
				/>
			</div>
		</Stage>
	);
}
