import { type CSSProperties, Fragment, type ReactNode, useRef } from "react";
import { useActive } from "./demo-stage";
import { Reveal } from "./reveal";

const STATEMENT =
	"A calmer way to run a team. Zadaci keeps plans, docs and decisions next to the tasks they belong to, so the work explains itself and everyone can see what comes next.";

/** The statement inks in word by word, grey to full ink, as it scrolls through (CSS view timeline). */
function ScrollWords() {
	const words = STATEMENT.split(" ");
	return (
		<p className="lp-ink max-w-4xl text-[1.6rem] leading-[1.25] font-medium tracking-[-0.02em] text-balance text-(color:--q-text) sm:text-[2.25rem]">
			{words.map((w, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence, split once
				<Fragment key={i}>
					<span style={{ "--i": i, "--n": words.length } as CSSProperties}>
						{w}
					</span>{" "}
				</Fragment>
			))}
		</p>
	);
}

/** A looping line drawing that plays only while on screen (static with reduced motion). */
function Art({ label, children }: { label: string; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	const play = useActive(ref);
	return (
		<div ref={ref} className="lp-art" data-play={play || undefined}>
			<svg
				viewBox="0 0 160 112"
				className="mx-auto h-auto w-full max-w-64 text-(color:--q-text-4) md:mx-0 md:h-28 md:w-40"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
				role="img"
				aria-label={label}
			>
				{children}
			</svg>
		</div>
	);
}

/** A person: a round frame with a head and shoulders. */
function Person({ x, y, r = 12 }: { x: number; y: number; r?: number }) {
	const k = r / 12;
	return (
		<g>
			<circle cx={x} cy={y} r={r} />
			<circle cx={x} cy={y - 3 * k} r={3.6 * k} />
			<path d={`M${x - 6.5 * k} ${y + 8 * k} q${6.5 * k} -7.5 ${13 * k} 0`} />
		</g>
	);
}

const v = (o: Record<string, string>) => o as CSSProperties;

/** Teammates arriving at one board. */
const Converge = (
	<>
		<rect x="40" y="44" width="80" height="54" rx="6" />
		<path d="M40 54h80M66.7 54v44M93.3 54v44" />
		<rect x="45" y="59" width="17" height="8" rx="2" />
		<rect x="71.7" y="59" width="17" height="8" rx="2" />
		<rect x="45" y="71" width="17" height="8" rx="2" />
		<rect
			className="lp-a1-card"
			x="98.3"
			y="59"
			width="17"
			height="8"
			rx="2"
			stroke="var(--q-accent)"
		/>
		{[
			[53, 26, "-34px", "-8px", "0s"],
			[80, 22, "0px", "-16px", "0.12s"],
			[107, 26, "34px", "-8px", "0.24s"],
		].map(([x, y, fx, fy, dl]) => (
			<g
				key={String(x)}
				className="lp-a1-av"
				style={v({
					"--fx": String(fx),
					"--fy": String(fy),
					"--dl": String(dl),
				})}
			>
				<Person x={Number(x)} y={Number(y)} r={8} />
			</g>
		))}
	</>
);

/** A task card handed from one teammate to another. */
const Handoff = (
	<>
		<Person x={34} y={66} />
		<Person x={126} y={66} />
		<circle
			className="lp-ping"
			cx="126"
			cy="66"
			r="17"
			stroke="var(--q-accent)"
		/>
		<g className="lp-a2-card">
			<rect
				x="48"
				y="56"
				width="22"
				height="16"
				rx="3"
				stroke="var(--q-accent)"
			/>
			<path d="M52 61.5h11M52 66.5h7" stroke="var(--q-accent)" />
		</g>
		<path d="M50 84 C 70 94, 90 94, 110 84" strokeDasharray="2 4" />
	</>
);

/** A live cursor leaving a comment that pings a teammate. */
const Mention = (
	<>
		<g className="lp-a3-bubble">
			<path d="M28 22h70a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H54l-8 8v-8H28a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" />
			<path d="M32 33h40M32 41h26" />
			<path d="M78 41h18" stroke="var(--q-accent)" />
		</g>
		<Person x={124} y={80} />
		<circle
			className="lp-ping"
			cx="124"
			cy="80"
			r="17"
			stroke="var(--q-accent)"
		/>
		<g className="lp-a3-cursor">
			<path
				d="M96 50l11 4.5-4.6 1.6-1.9 4.7z"
				fill="var(--q-accent)"
				stroke="var(--q-accent)"
			/>
		</g>
	</>
);

const ITEMS = [
	{
		title: "One place for the work",
		body: "Projects, notes, files and conversations live side by side, so nobody hunts through five apps for one answer.",
		art: Converge,
		label: "Three teammates arriving at one shared board",
	},
	{
		title: "Hand work off cleanly",
		body: "Assign a task and it arrives with its subtasks, comments and files, so whoever picks it up never starts from zero.",
		art: Handoff,
		label: "A task card passed from one person to another",
	},
	{
		title: "People and agents, together",
		body: "Mention a teammate and they hear about it at once. Zad and your AI agents work in the same projects, with your access.",
		art: Mention,
		label: "A comment that mentions a teammate, who gets a ping",
	},
];

export function Principles() {
	return (
		<section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
			<ScrollWords />
			<ul className="mt-12 grid gap-3 sm:mt-16 md:grid-cols-3 md:gap-0">
				{ITEMS.map((item, i) => (
					<Reveal
						as="li"
						key={item.title}
						delay={i * 0.1}
						className="rounded-(--q-r-lg) border border-(color:--q-border) bg-(--q-surface) p-5 md:rounded-none md:border-0 md:border-l md:bg-transparent md:p-0 md:px-8 md:first:border-l-0 md:first:pl-0"
					>
						<Art label={item.label}>{item.art}</Art>
						<h3 className="mt-5 text-[17px] font-semibold tracking-tight">
							{item.title}
						</h3>
						<p className="mt-2 text-[14.5px] md:max-w-xs leading-relaxed text-(color:--q-text-3)">
							{item.body}
						</p>
					</Reveal>
				))}
			</ul>
		</section>
	);
}
