import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useInView,
	useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

type Col = "todo" | "doing" | "done";
type Card = { id: string; title: string; tag: string; color: string; col: Col };

const COLS: { id: Col; name: string; dot: string }[] = [
	{ id: "todo", name: "To Do", dot: "border-black/30 dark:border-white/35" },
	{ id: "doing", name: "In Progress", dot: "border-amber-500 bg-amber-500/30" },
	{ id: "done", name: "Done", dot: "border-emerald-500 bg-emerald-500" },
];

const START: Card[] = [
	{
		id: "a",
		title: "Pricing page copy",
		tag: "Content",
		color: "#e0607e",
		col: "todo",
	},
	{
		id: "b",
		title: "Search in notes",
		tag: "Frontend",
		color: "#3b82c4",
		col: "todo",
	},
	{
		id: "c",
		title: "Invite flow emails",
		tag: "Backend",
		color: "#14a39a",
		col: "todo",
	},
	{
		id: "d",
		title: "Roadmap review",
		tag: "Research",
		color: "#d39a1f",
		col: "doing",
	},
	{
		id: "e",
		title: "Icon set refresh",
		tag: "Design",
		color: "#8662c9",
		col: "done",
	},
];

const WHO = [
	{ name: "Leo", color: "#3ecf8e" },
	{ name: "Amara", color: "#f0883e" },
	{ name: "Maya", color: "#ffb703" },
];

/** The next board after one teammate moves one card along (and recycles finished work). */
function step(cards: Card[]): { cards: Card[]; moved: string } {
	const doing = cards.filter((c) => c.col === "doing");
	const done = cards.filter((c) => c.col === "done");
	const pick =
		doing.length >= 2 ? doing[0] : cards.find((c) => c.col === "todo");
	if (!pick) return { cards, moved: "" };
	const to: Col = pick.col === "doing" ? "done" : "doing";
	let next = [...cards.filter((c) => c.id !== pick.id), { ...pick, col: to }];
	if (done.length + (to === "done" ? 1 : 0) > 2) {
		const old = done[0];
		next = [
			...next.filter((c) => c.id !== old.id),
			{ ...old, col: "todo" as Col },
		];
	}
	return { cards: next, moved: pick.id };
}

export function LiveBoard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { margin: "-80px" });
	const reduce = useReducedMotion();
	const [state, setState] = useState({ cards: START, moved: "", turn: 0 });

	useEffect(() => {
		if (!inView) return;
		const id = setInterval(() => {
			setState((s) => ({ ...step(s.cards), turn: s.turn + 1 }));
		}, 2200);
		return () => clearInterval(id);
	}, [inView]);

	const who = WHO[state.turn % WHO.length];

	return (
		<div
			ref={ref}
			className="grid grid-cols-3 gap-2 rounded-xl border border-black/[0.08] bg-[#f6f5f2]/95 p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.3)] backdrop-blur dark:border-white/[0.08] dark:bg-[#18181b]/95"
		>
			<LayoutGroup>
				{COLS.map((col) => (
					<div key={col.id} className="min-w-0">
						<div className="flex items-center gap-1.5 px-1.5 pt-1 pb-2 text-[11.5px] font-medium">
							<span
								className={`size-2.5 rounded-full border-[1.5px] ${col.dot}`}
							/>
							<span className="truncate">{col.name}</span>
						</div>
						<ul className="flex min-h-40 flex-col gap-1.5">
							{state.cards
								.filter((c) => c.col === col.id)
								.map((c) => (
									<motion.li
										key={c.id}
										layout={!reduce}
										layoutId={reduce ? undefined : c.id}
										transition={{ type: "spring", duration: 0.6, bounce: 0.15 }}
										className="relative rounded-lg border border-black/[0.07] bg-white p-2 dark:border-white/[0.07] dark:bg-[#202024]"
									>
										<span className="flex items-center gap-1 text-[10px] text-black/50 dark:text-white/45">
											<span
												className="size-1.5 rounded-full"
												style={{ background: c.color }}
											/>
											{c.tag}
										</span>
										<span
											className={`mt-1 block text-[11.5px] leading-snug font-medium ${c.col === "done" ? "text-black/40 line-through dark:text-white/35" : ""}`}
										>
											{c.title}
										</span>
										<AnimatePresence>
											{c.id === state.moved && (
												<motion.span
													key={state.turn}
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													exit={{ opacity: 0 }}
													transition={{ duration: 0.25 }}
													className="pointer-events-none absolute -right-1 -bottom-3 z-10 flex items-start"
													aria-hidden="true"
												>
													<svg
														viewBox="0 0 16 16"
														className="size-3.5"
														aria-hidden="true"
													>
														<path
															d="M2 1 L14 7 L8.5 8.5 L6 14 Z"
															fill={who.color}
															stroke="#141612"
															strokeWidth="1.2"
															strokeLinejoin="round"
														/>
													</svg>
													<span
														className="mt-2.5 rounded-full border border-[#141612] px-1.5 text-[9.5px] font-bold text-[#141612]"
														style={{ background: who.color }}
													>
														{who.name}
													</span>
												</motion.span>
											)}
										</AnimatePresence>
									</motion.li>
								))}
						</ul>
					</div>
				))}
			</LayoutGroup>
		</div>
	);
}
