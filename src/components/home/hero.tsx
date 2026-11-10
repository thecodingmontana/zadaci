import {
	motion,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform,
} from "motion/react";
import { useRef } from "react";
import { MultiplayerText } from "./multiplayer-text";
import { Reveal, Shot } from "./reveal";

const PLAYERS = [
	{ name: "Olive Bishop", color: "#3ecf8e" },
	{ name: "Blackie", color: "#f0883e" },
	{ name: "Ebra Kitavey", color: "#ffb703" },
];

export function Hero() {
	const frame = useRef<HTMLDivElement>(null);
	const reduce = useReducedMotion();
	// the screenshot starts tipped back and settles flat as it scrolls up the page
	const { scrollYProgress } = useScroll({
		target: frame,
		offset: ["start end", "start 0.25"],
	});
	const tilt = useSpring(useTransform(scrollYProgress, [0, 1], [18, 0]), {
		stiffness: 120,
		damping: 30,
	});
	const transform = useTransform(
		tilt,
		(t) => `perspective(1600px) rotateX(${reduce ? 0 : t}deg)`,
	);

	return (
		<section id="top" className="relative overflow-hidden">
			<div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28 lg:pt-36">
				<h1 className="sr-only">
					Zadaci: collaborative task management for teams
				</h1>
				<MultiplayerText
					text="Turning team productivity into a powerful daily habit"
					className="max-w-4xl text-[2.6rem] leading-[1.08] font-semibold tracking-[-0.035em] text-[#121212] sm:text-6xl lg:text-[4.5rem] dark:text-white"
					players={PLAYERS}
					interval={1500}
				/>
				<Reveal
					immediate
					delay={0.15}
					className="mt-12 flex flex-col gap-4 sm:mt-16 md:flex-row md:items-end md:justify-between"
				>
					<p className="max-w-lg text-[16px] leading-relaxed text-pretty text-black/55 sm:text-[17px] dark:text-white/50">
						Projects, tasks, notes and chat in one calm workspace. Built for
						teams, and for the AI agents they work with.
					</p>
					<a
						href="#github"
						className="group flex shrink-0 items-center gap-2 text-[14.5px]"
					>
						<span className="font-medium">New</span>
						<span className="text-black/55 transition-colors group-hover:text-black dark:text-white/50 dark:group-hover:text-white">
							GitHub comments sync both ways
						</span>
						<span
							aria-hidden="true"
							className="icon-[solar--arrow-right-linear] size-4 text-black/55 transition-transform duration-200 ease-out group-hover:translate-x-0.5 dark:text-white/50"
						/>
					</a>
				</Reveal>
			</div>

			<div className="relative mx-auto mt-14 max-w-[76rem] px-3 sm:mt-20 sm:px-6">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-[10%] top-[8%] h-2/3 rounded-full bg-[radial-gradient(closest-side,rgba(249,116,82,0.22),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(249,116,82,0.16),transparent)]"
				/>
				<Reveal immediate delay={0.25}>
					<motion.div
						ref={frame}
						style={{ transform, transformOrigin: "50% 0%" }}
						className="relative rounded-xl border border-black/[0.08] bg-white/60 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] sm:rounded-2xl sm:p-2 dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
					>
						<div className="overflow-hidden rounded-lg border border-black/[0.06] sm:rounded-xl dark:border-white/[0.06]">
							<Shot
								name="board"
								alt="A Zadaci project board with tasks in Backlog, To Do, In Progress and Review"
								priority
							/>
						</div>
					</motion.div>
				</Reveal>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-b from-transparent to-[#fbfaf8] dark:to-[#0b0b0c]"
				/>
			</div>
		</section>
	);
}
