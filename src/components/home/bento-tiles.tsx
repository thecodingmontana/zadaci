import { AnimatePresence, useReducedMotion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { ToastCard } from "#/components/toast/toast-card";
import type { ToastData } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { useDemoLoop, type Wait } from "./demo-stage";

// Small live pieces of the real app for the bento grid, each with the app's own classes and its
// own motion (the menu's popIn, the toast card, the timer's 1s tick). They loop only on screen.

/** A fixed-height window onto app UI that plays `script` while visible. */
export function Live({
	h,
	script,
	reset,
	end,
	children,
}: {
	h: number;
	script: (w: Wait) => Promise<void>;
	reset: () => void;
	end: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useDemoLoop(ref, script, reset, end);
	return (
		<div
			ref={ref}
			inert
			aria-hidden="true"
			className="relative overflow-hidden text-(length:--q-fs) text-(color:--q-text)"
			style={{ height: h }}
		>
			{children}
		</div>
	);
}

const LAYOUT = { ty: 0, s: 1, o: 1, contentShown: true, z: 1 };
export function Toast({ t }: { t: ToastData | null }) {
	const reduce = useReducedMotion() ?? false;
	return (
		<div
			className="tst-root absolute inset-x-3 bottom-3"
			style={{ height: 60 }}
		>
			<AnimatePresence>
				{t && (
					<ToastCard
						key={t.id}
						t={t}
						layout={LAYOUT}
						paused={false}
						reduce={reduce}
						isBottom
						onHeight={() => {}}
						onClose={() => {}}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

const CMDS = [
	["Search workspace", "icon-[solar--magnifer-linear]", "/"],
	["Ask Zad", "icon-[hugeicons--ai-magic]", "Ctrl J"],
	["New task", "icon-[solar--check-circle-linear]"],
	["Go to Bookmarks", "icon-[solar--bookmark-linear]"],
	["Go to My Tasks", "icon-[solar--checklist-minimalistic-linear]"],
	["Switch to dark mode", "icon-[solar--moon-linear]"],
	["Invite member", "icon-[solar--user-plus-linear]"],
] as const;

export function CommandTile() {
	const [q, setQ] = useState("");
	const type = async (wait: Wait, word: string) => {
		for (let i = 1; i <= word.length; i++) {
			await wait(110);
			setQ(word.slice(0, i));
		}
	};
	const shown = CMDS.filter(([name]) =>
		name.toLowerCase().includes(q.toLowerCase()),
	).slice(0, 4);
	return (
		<Live
			h={232}
			reset={() => setQ("")}
			end={() => setQ("book")}
			script={async (w) => {
				await w(900);
				await type(w, "book");
				await w(1800);
				setQ("");
				await w(700);
				await type(w, "inv");
				await w(1800);
			}}
		>
			<div
				className="palette"
				style={{
					position: "absolute",
					top: 12,
					left: 12,
					right: 12,
					width: "auto",
					transform: "none",
					maxHeight: "none",
				}}
			>
				<div className="pal-in">
					<span className="icon-[solar--command-linear] size-[17px] shrink-0 text-(--q-text-3)" />
					<input
						value={q}
						readOnly
						tabIndex={-1}
						placeholder="Type a command or search…"
					/>
					<kbd>Esc</kbd>
				</div>
				<div className="pal-list">
					<div className="pal-group">
						<div className="pal-sec">{q ? "Commands" : "Suggestions"}</div>
						{shown.map(([name, icon, k], i) => {
							const at = name.toLowerCase().indexOf(q.toLowerCase());
							return (
								<div key={name} className={cn("pi", i === 0 && "hl")}>
									<span className={cn(icon, "i size-[15px] shrink-0")} />
									<span className="trunc">
										{q ? (
											<>
												{name.slice(0, at)}
												<mark>{name.slice(at, at + q.length)}</mark>
												{name.slice(at + q.length)}
											</>
										) : (
											name
										)}
									</span>
									<span className="r">{k && <kbd>{k}</kbd>}</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</Live>
	);
}

const fmt = (s: number) => {
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return h ? `${h}h ${m}m` : m ? `${m}m` : `${s}s`;
};

export function TimerTile() {
	const [secs, setSecs] = useState(0);
	const [running, setRunning] = useState(false);
	return (
		<Live
			h={120}
			reset={() => {
				setSecs(0);
				setRunning(false);
			}}
			end={() => setSecs(2 * 3600 + 14 * 60)}
			script={async (w) => {
				await w(1000);
				setRunning(true);
				for (let i = 1; i <= 9; i++) {
					await w(1000); // the app's timer ticks once a second
					setSecs(i);
				}
				setRunning(false);
				setSecs(0);
				await w(600);
			}}
		>
			<dl className="kv" style={{ margin: "18px 16px" }}>
				<dt>
					<span className="icon-[solar--clock-circle-linear] size-3.5" />
					Time
				</dt>
				<dd>
					<div className="row" style={{ gap: 8 }}>
						<span
							className={cn(!secs && "faint")}
							style={{ fontVariantNumeric: "tabular-nums" }}
						>
							{secs ? fmt(secs) : "Nothing logged"}
						</span>
						<span
							className={cn(
								"btn btn-sm",
								running ? "btn-secondary" : "btn-ghost",
							)}
						>
							<span
								className={cn(
									running
										? "icon-[solar--stop-circle-linear]"
										: "icon-[solar--play-circle-linear]",
									"size-3.5",
								)}
							/>
							{running ? "Stop" : "Start timer"}
						</span>
					</div>
				</dd>
			</dl>
		</Live>
	);
}

export function StatusTile() {
	const [state, setState] = useState<"none" | "offline" | "update">("none");
	return (
		<Live
			h={120}
			reset={() => setState("none")}
			end={() => setState("update")}
			script={async (w) => {
				await w(900);
				setState("offline");
				await w(2600);
				setState("update");
				await w(2600);
			}}
		>
			{state !== "none" && (
				<div
					className={cn("app-status", state)}
					style={{
						position: "absolute",
						left: 12,
						right: 12,
						bottom: 16,
						transform: "none",
						width: "auto",
						maxWidth: "none",
					}}
				>
					<span
						className={cn(
							state === "offline"
								? "icon-[solar--wi-fi-router-minimalistic-linear]"
								: "icon-[solar--refresh-circle-linear]",
							"size-[15px] shrink-0",
						)}
					/>
					<span className="grow">
						<b>
							{state === "offline"
								? "You're offline."
								: "A new version of Zadaci is ready."}
						</b>
					</span>
					<span
						className={cn(
							"btn btn-sm",
							state === "offline" ? "btn-secondary" : "btn-primary",
						)}
					>
						{state === "offline" ? "Try again" : "Reload"}
					</span>
				</div>
			)}
		</Live>
	);
}
