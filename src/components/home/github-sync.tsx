import {
	AnimatePresence,
	motion,
	useInView,
	useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

// One conversation, written on either side, showing up on the other a moment later.
const THREAD = [
	{
		from: "zadaci",
		who: "Maya Chen",
		text: "Repro: edit the same list on two phones while offline.",
	},
	{
		from: "github",
		who: "leopark",
		text: "Fix is up in #214. Last write wins per field now.",
	},
	{
		from: "zadaci",
		who: "Amara Osei",
		text: "Tested on iPad and iPhone, no lost edits 🙌",
	},
	{ from: "github", who: "leopark", text: "Merged. Closing this one." },
];

type SideId = "github" | "zadaci";

function Comment({
	who,
	text,
	mirrored,
}: {
	who: string;
	text: string;
	mirrored: boolean;
}) {
	return (
		<div className="rounded-lg border border-black/[0.07] bg-black/[0.015] p-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
			<div className="flex items-center gap-1.5 text-[11px] text-black/45 dark:text-white/40">
				<span className="font-medium text-black/75 dark:text-white/75">
					{who}
				</span>
				{mirrored && (
					<span className="flex items-center gap-0.5">
						<span
							aria-hidden="true"
							className="icon-[solar--refresh-linear] size-3"
						/>
						synced
					</span>
				)}
			</div>
			<p className="mt-1 text-[12.5px] leading-snug">{text}</p>
		</div>
	);
}

function Side({ side, shown }: { side: SideId; shown: number }) {
	const reduce = useReducedMotion();
	const github = side === "github";
	return (
		<div className="min-w-0 flex-1 rounded-xl border border-black/[0.08] bg-white p-3 sm:p-4 dark:border-white/[0.08] dark:bg-[#141416]">
			<div className="flex items-center gap-2 border-b border-black/[0.06] pb-3 dark:border-white/[0.06]">
				<span
					aria-hidden="true"
					className={
						github
							? "icon-[simple-icons--github] size-4"
							: "icon-[solar--check-circle-linear] size-4 text-[#F97452]"
					}
				/>
				<span className="truncate text-[13px] font-medium">
					{github ? "northwind/mobile #198" : "MA-5 Sync conflicts"}
				</span>
				<span
					className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${shown >= THREAD.length ? "bg-violet-500/15 text-violet-600 dark:text-violet-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}
				>
					{shown >= THREAD.length
						? github
							? "Closed"
							: "Done"
						: github
							? "Open"
							: "In Progress"}
				</span>
			</div>
			<ul className="flex min-h-60 flex-col gap-2 pt-3">
				<AnimatePresence initial={false}>
					{THREAD.slice(0, shown).map((c) => (
						<motion.li
							key={c.text}
							initial={{
								opacity: 0,
								transform: reduce ? "none" : "translateY(8px)",
							}}
							animate={{ opacity: 1, transform: "translateY(0px)" }}
							transition={{
								duration: 0.45,
								delay: c.from === side ? 0 : 0.7,
								ease: [0.23, 1, 0.32, 1],
							}}
						>
							<Comment who={c.who} text={c.text} mirrored={c.from !== side} />
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
		</div>
	);
}

export function GithubSync() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { margin: "-120px" });
	const [shown, setShown] = useState(2);

	useEffect(() => {
		if (!inView) return;
		// add a comment every 2.4 s; after the last one, hold, then start the thread again
		const id = setInterval(
			() => setShown((n) => (n > THREAD.length + 1 ? 2 : n + 1)),
			2400,
		);
		return () => clearInterval(id);
	}, [inView]);

	const visible = Math.min(shown, THREAD.length);

	return (
		<div
			ref={ref}
			className="relative flex flex-col gap-3 sm:flex-row sm:gap-10"
		>
			<Side side="github" shown={visible} />
			<div
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-1/2 hidden h-px w-10 -translate-x-1/2 overflow-hidden bg-black/10 sm:block dark:bg-white/10"
			>
				<span className="absolute inset-y-0 w-3 animate-[sync-dot_1.6s_linear_infinite] bg-[#F97452] motion-reduce:hidden" />
			</div>
			<Side side="zadaci" shown={visible} />
		</div>
	);
}
