import { Link } from "@tanstack/react-router";
import {
	motion,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform,
} from "motion/react";
import { type CSSProperties, useRef } from "react";
import { MultiplayerText } from "./multiplayer-text";
import { Reveal, Shot } from "./reveal";

/** the app's large button size (.btn at --q-h-lg), for the page's main calls to action */
export const BTN_LG = {
	"--h": "var(--q-h-lg)",
	padding: "0 14px",
	fontSize: "var(--q-fs-md)",
} as CSSProperties;

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
					className="max-w-4xl text-[2.6rem] leading-[1.2] sm:leading-[1.08] font-semibold tracking-[-0.035em] text-(color:--q-text) sm:text-6xl lg:text-[4.5rem]"
					players={PLAYERS}
					interval={1500}
				/>
				<Reveal
					immediate
					delay={0.15}
					className="mt-14 flex flex-col gap-8 sm:mt-16 md:flex-row md:items-end md:justify-between"
				>
					<div className="flex flex-col gap-6">
						<p className="max-w-lg text-[16px] leading-relaxed text-pretty text-(color:--q-text-3) sm:text-[17px]">
							Projects, tasks, notes and chat in one calm workspace. Built for
							teams, and for the AI agents they work with.
						</p>
						<div className="flex items-center gap-3">
							<Link
								to="/auth/signin"
								className="btn btn-primary"
								style={BTN_LG}
							>
								Get started
							</Link>
							<Link
								to="/auth/signin"
								className="btn btn-secondary"
								style={BTN_LG}
							>
								Sign in
							</Link>
						</div>
					</div>
					<a
						href="#github"
						className="group flex shrink-0 items-center gap-2 text-[14.5px]"
					>
						<span className="font-medium">New</span>
						<span className="text-(color:--q-text-3) transition-colors group-hover:text-(color:--q-text)">
							GitHub comments sync both ways
						</span>
						<span
							aria-hidden="true"
							className="icon-[solar--arrow-right-linear] size-4 text-(color:--q-text-3) transition-transform duration-200 ease-out group-hover:translate-x-0.5"
						/>
					</a>
				</Reveal>
			</div>

			<div className="relative mx-auto mt-12 max-w-[76rem] px-3 sm:mt-20 sm:px-6">
				<Reveal immediate delay={0.25}>
					<motion.div
						ref={frame}
						style={{ transform, transformOrigin: "50% 0%" }}
						className="relative rounded-xl border border-(color:--q-border) bg-(--q-surface-2) p-1.5 sm:rounded-2xl sm:p-2"
					>
						<div className="overflow-hidden rounded-md border border-(color:--q-border) sm:rounded-lg">
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
					className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-b from-transparent to-(--q-bg)"
				/>
			</div>
		</section>
	);
}
