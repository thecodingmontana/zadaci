import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const QUESTION = "What's still blocking the mobile release?";
const ANSWER =
	"Two things. Sync conflicts when two people edit (urgent, Leo, due Friday) is the last open blocker. Beta feedback round two is waiting on it. Want me to move the beta date to next Tuesday?";

const AGENT = [
	{
		who: "Claude Code",
		call: "listTasks",
		arg: 'project: "Mobile app 2.0"',
		out: "11 tasks",
	},
	{
		who: "Claude Code",
		call: "updateTask",
		arg: 'MA-5 → status: "In Review"',
		out: "done",
	},
	{
		who: "Cursor",
		call: "addComment",
		arg: 'MA-5 "Fix is in PR #214"',
		out: "posted",
	},
	{
		who: "ChatGPT",
		call: "createNote",
		arg: '"Release notes 2.0"',
		out: "created",
	},
];

/** Zad answering a question as it types, next to outside agents calling Zadaci's MCP tools. */
export function ZadDemo() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-120px" });
	const reduce = useReducedMotion();
	const [chars, setChars] = useState(0);

	useEffect(() => {
		if (!inView) return;
		if (reduce) {
			setChars(ANSWER.length);
			return;
		}
		let n = 0;
		let id: ReturnType<typeof setInterval> | undefined;
		const start = setTimeout(() => {
			id = setInterval(() => {
				n += 2;
				setChars(Math.min(n, ANSWER.length));
				if (n >= ANSWER.length) clearInterval(id);
			}, 28);
		}, 900);
		return () => {
			clearTimeout(start);
			clearInterval(id);
		};
	}, [inView, reduce]);

	const typing = chars < ANSWER.length;

	return (
		<div ref={ref} className="grid gap-3 md:grid-cols-[1.15fr_1fr]">
			<div className="rounded-xl border border-black/[0.08] bg-white p-4 sm:p-5 dark:border-white/[0.08] dark:bg-[#141416]">
				<div className="flex items-center gap-2 border-b border-black/[0.06] pb-3 text-[13px] font-medium dark:border-white/[0.06]">
					<span
						aria-hidden="true"
						className="icon-[hugeicons--ai-magic] size-4 text-[#F97452]"
					/>
					Zad
				</div>
				<div className="flex min-h-64 flex-col gap-3 pt-4 text-[13.5px] leading-relaxed">
					<p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-black/[0.05] px-3.5 py-2 dark:bg-white/[0.07]">
						{QUESTION}
					</p>
					<div className="flex flex-wrap gap-1.5">
						{["Read Mobile app 2.0", "Checked 11 tasks"].map((t, i) => (
							<motion.span
								key={t}
								initial={{ opacity: 0 }}
								animate={inView ? { opacity: 1 } : {}}
								transition={{ delay: 0.3 + i * 0.25 }}
								className="flex items-center gap-1 rounded-full border border-black/[0.07] px-2 py-0.5 text-[11px] text-black/50 dark:border-white/[0.08] dark:text-white/45"
							>
								<span
									aria-hidden="true"
									className="icon-[solar--check-circle-linear] size-3 text-emerald-500"
								/>
								{t}
							</motion.span>
						))}
					</div>
					<p className="text-black/80 dark:text-white/80">
						<span className="sr-only">{ANSWER}</span>
						<span aria-hidden="true">
							{ANSWER.slice(0, chars)}
							{typing && inView && (
								<span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-[#F97452]" />
							)}
						</span>
					</p>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-black/[0.08] bg-[#f6f5f2] font-ibm-plex-mono text-[11.5px] dark:border-white/[0.08] dark:bg-[#111113]">
				<div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 text-black/50 dark:border-white/[0.06] dark:text-white/45">
					<span>mcp · zadaci</span>
					<span className="flex items-center gap-1.5">
						<span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
						connected
					</span>
				</div>
				<ul className="flex flex-col gap-3 p-4">
					{AGENT.map((a, i) => (
						<motion.li
							key={a.call + a.arg}
							initial={{
								opacity: 0,
								transform: reduce ? "none" : "translateY(6px)",
							}}
							animate={
								inView ? { opacity: 1, transform: "translateY(0px)" } : {}
							}
							transition={{
								delay: 0.6 + i * 0.9,
								duration: 0.5,
								ease: [0.23, 1, 0.32, 1],
							}}
							className="leading-relaxed"
						>
							<span className="text-black/40 dark:text-white/35">{a.who}</span>
							<br />
							<span className="text-[#F97452]">{a.call}</span>
							<span className="text-black/70 dark:text-white/70">
								({a.arg})
							</span>
							<span className="text-emerald-600 dark:text-emerald-400">
								{" "}
								✓ {a.out}
							</span>
						</motion.li>
					))}
				</ul>
			</div>
		</div>
	);
}
