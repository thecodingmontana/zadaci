import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "./reveal";

// Line drawings: isometric planes in 2:1 projection, drawn on when they scroll into view.
const LAYERS = [
	"M20 70 L80 40 L140 70 L80 100 Z",
	"M20 55 L80 25 L140 55 L80 85 Z",
	"M20 40 L80 10 L140 40 L80 70 Z",
];
const KEY = [
	"M30 62 L80 37 L130 62 L80 87 Z",
	"M30 62 L30 78 L80 103 L130 78 L130 62",
	"M80 87 L80 103",
	"M62 58 L80 49 L98 58 L80 67 Z",
];
const PAIR = [
	"M18 74 L62 52 L106 74 L62 96 Z",
	"M54 54 L98 32 L142 54 L98 76 Z",
	"M98 32 L98 14",
	"M93 16 L98 8 L103 16",
	"M62 52 L62 34",
	"M57 36 L62 28 L67 36",
];

function Drawing({ paths, label }: { paths: string[]; label: string }) {
	const reduce = useReducedMotion();
	return (
		<svg
			viewBox="0 0 160 112"
			className="h-28 w-40 text-black/45 dark:text-white/40"
			fill="none"
			stroke="currentColor"
			strokeWidth="1"
			strokeLinejoin="round"
			role="img"
			aria-label={label}
		>
			{paths.map((d, i) => (
				<motion.path
					key={d}
					d={d}
					initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
					whileInView={{ pathLength: 1, opacity: 1 }}
					viewport={{ once: true }}
					transition={{
						duration: reduce ? 0.4 : 1.1,
						delay: 0.2 + i * 0.15,
						ease: [0.77, 0, 0.175, 1],
					}}
					className={i === paths.length - 1 ? "text-[#F97452]" : undefined}
					stroke="currentColor"
				/>
			))}
		</svg>
	);
}

const ITEMS = [
	{
		n: "01",
		title: "One place for the work",
		body: "Projects, notes, files and conversations live side by side, so nobody hunts through five apps for one answer.",
		paths: LAYERS,
		label: "Three stacked planes",
	},
	{
		n: "02",
		title: "Fast by default",
		body: "Everything is a keystroke away. Press ⌘K, jump anywhere, and changes appear for the whole team as they happen.",
		paths: KEY,
		label: "A single keyboard key",
	},
	{
		n: "03",
		title: "People and agents, together",
		body: "Zad and your own AI agents work in the same projects as you, with exactly the access you give them.",
		paths: PAIR,
		label: "Two planes rising side by side",
	},
];

export function Principles() {
	return (
		<section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
			<Reveal>
				<p className="max-w-4xl text-[1.6rem] leading-[1.25] font-medium tracking-[-0.02em] text-balance text-black/40 sm:text-[2.25rem] dark:text-white/35">
					<span className="text-[#121212] dark:text-white">
						A calmer way to run a team.
					</span>{" "}
					Zadaci keeps plans, docs and decisions next to the tasks they belong
					to, so the work explains itself and everyone can see what comes next.
				</p>
			</Reveal>
			<ul className="mt-16 grid gap-12 sm:mt-24 md:grid-cols-3 md:gap-0">
				{ITEMS.map((item, i) => (
					<Reveal
						as="li"
						key={item.n}
						delay={i * 0.08}
						className="md:border-l md:border-black/[0.08] md:px-8 md:first:border-l-0 md:first:pl-0 dark:md:border-white/[0.08]"
					>
						<span className="font-ibm-plex-mono text-[11px] tracking-wider text-black/40 uppercase dark:text-white/35">
							{item.n}
						</span>
						<div className="my-8">
							<Drawing paths={item.paths} label={item.label} />
						</div>
						<h3 className="text-[17px] font-semibold tracking-tight">
							{item.title}
						</h3>
						<p className="mt-2 max-w-xs text-[14.5px] leading-relaxed text-black/55 dark:text-white/50">
							{item.body}
						</p>
					</Reveal>
				))}
			</ul>
		</section>
	);
}
