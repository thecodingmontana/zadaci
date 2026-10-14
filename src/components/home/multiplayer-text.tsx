import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "#/lib/utils";

export interface MultiplayerTextPlayer {
	name: string;
	color: string;
}

type Cursor = { x: number; y: number; rot: number };
type Center = { x: number; y: number; bottom: number };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const SPRING = { type: "spring", duration: 0.5, bounce: 0.16 } as const;
const DROP = { type: "spring", duration: 0.55, bounce: 0.28 } as const;
const PRESS = { duration: 0.09, ease: EASE_OUT };

const TRAVEL_S = 0.65;
const PRESS_MS = 170;

const HAND_POINT =
	"M9 14 L9 4 A2.5 2.5 0 0 1 14 4 L14 12 L16 12 A6 6 0 0 1 22 18 L22 20 A7 7 0 0 1 15 27 L13 27 A8 8 0 0 1 5 19 L5 17.5 A4 4 0 0 1 9 14 Z";
const HAND_PRESS =
	"M9 14 L9 10.5 A2.5 2.5 0 0 1 14 10.5 L14 12 L16 12 A6 6 0 0 1 22 18 L22 20 A7 7 0 0 1 15 27 L13 27 A8 8 0 0 1 5 19 L5 17.5 A4 4 0 0 1 9 14 Z";

// Deterministic pseudo-random so server and client render the same scatter.
const round = (n: number) => Math.round(n * 1000) / 1000;

function seeded(n: number) {
	const x = Math.sin(n * 12.9898) * 43758.5453;
	return x - Math.floor(x);
}

export function MultiplayerText({
	text,
	players,
	interval = 1400,
	scatter = true,
	className,
}: {
	text: string;
	players: MultiplayerTextPlayer[];
	interval?: number;
	scatter?: boolean;
	className?: string;
}) {
	const reduce = useReducedMotion() ?? false;
	const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

	const containerRef = useRef<HTMLDivElement>(null);
	const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
	const [layout, setLayout] = useState<{
		w: number;
		h: number;
		centers: Center[];
	} | null>(null);
	const [inView, setInView] = useState(false);
	const [cursors, setCursors] = useState<(Cursor | null)[]>(() =>
		players.map(() => null),
	);
	const [owners, setOwners] = useState<(number | null)[]>([]);
	const [pressed, setPressed] = useState<{
		player: number;
		word: number;
	} | null>(null);
	const targets = useRef<number[]>([]);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => {
			const c = el.getBoundingClientRect();
			setLayout({
				w: c.width,
				h: c.height,
				centers: words.map((_, i) => {
					const r = wordRefs.current[i]?.getBoundingClientRect();
					if (!r)
						return { x: c.width / 2, y: c.height / 2, bottom: c.height / 2 };
					return {
						x: r.left - c.left + r.width / 2,
						y: r.top - c.top + r.height / 2,
						bottom: r.bottom - c.top,
					};
				}),
			});
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		const io = new IntersectionObserver(
			([entry]) => setInView(entry?.isIntersecting ?? false),
			{
				threshold: 0.3,
			},
		);
		io.observe(el);
		return () => {
			ro.disconnect();
			io.disconnect();
		};
	}, [words]);

	// Initial placement, or a fixed resting placement for reduced motion.
	useEffect(() => {
		if (!layout) return;
		const { w, h, centers } = layout;
		const count = Math.max(words.length, 1);

		if (reduce) {
			const claimed: (number | null)[] = words.map(() => null);
			setCursors(
				players.map((_, i) => {
					const wi = Math.floor(seeded(i * 7.31 + 3) * count) % count;
					claimed[wi] = i;
					const c = centers[wi];
					return c
						? {
								x: c.x - 11 + (seeded(i * 3 + 2) - 0.5) * 16,
								y: c.bottom + 6,
								rot: (seeded(i + 53) - 0.5) * 20,
							}
						: null;
				}),
			);
			setOwners(claimed);
			return;
		}

		setCursors((prev) =>
			prev.some(Boolean)
				? prev
				: players.map((_, i) => {
						const last = centers[words.length - 1];
						if (i === players.length - 1 && last) {
							const topEdge = 2 * last.y - last.bottom;
							return {
								x: last.x - 11 + (seeded(i * 3 + 2) - 0.5) * 16,
								y: topEdge - 52,
								rot: (seeded(i + 41) - 0.5) * 20,
							};
						}
						return {
							x: w * (0.12 + 0.76 * seeded(i * 9.7 + 5)),
							y: h * (0.86 + 0.1 * seeded(i * 4.3 + 7)),
							rot: (seeded(i + 41) - 0.5) * 20,
						};
					}),
		);
	}, [layout, reduce, players, words]);

	// Choreography: one cursor per beat travels to a free word and presses it.
	useEffect(() => {
		if (!layout || !inView || reduce || words.length === 0) return;
		const count = words.length;
		const beat = Math.max(interval, 900);
		const timers: ReturnType<typeof setTimeout>[] = [];
		let cancelled = false;
		let step = 0;

		const tick = () => {
			if (cancelled) return;
			const p = step % players.length;
			const taken = new Set(targets.current);
			let wi = Math.floor(seeded(step * 7.31 + 3) * count) % count;
			for (let tries = 0; tries < count && taken.has(wi); tries += 1)
				wi = (wi + 1) % count;

			const prevWord = targets.current[p];
			targets.current[p] = wi;
			if (prevWord !== undefined) {
				setOwners((o) =>
					o[prevWord] === p ? o.map((v, i) => (i === prevWord ? null : v)) : o,
				);
			}

			const s = step;
			const c = layout.centers[wi];
			if (c) {
				const cursor = {
					x: c.x - 11 + (seeded(s * 3.7 + 17) - 0.5) * 22,
					y: c.bottom + 4 + seeded(s * 5.3 + 29) * 6,
					rot: (seeded(s * 2.9 + 53) - 0.5) * 26,
				};
				setCursors((prev) => prev.map((v, i) => (i === p ? cursor : v)));
				timers.push(
					setTimeout(() => {
						if (cancelled) return;
						setPressed({ player: p, word: wi });
						setOwners((o) =>
							words.map((_, i) => (i === wi ? p : (o[i] ?? null))),
						);
						timers.push(
							setTimeout(() => !cancelled && setPressed(null), PRESS_MS),
						);
					}, TRAVEL_S * 1000),
				);
			}
			step += 1;
			timers.push(setTimeout(tick, beat));
		};

		timers.push(setTimeout(tick, 400));
		return () => {
			cancelled = true;
			timers.forEach(clearTimeout);
		};
	}, [layout, inView, reduce, words, players.length, interval]);

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			<p className="text-balance">
				{words.map((word, i) => {
					const isPressed = !reduce && pressed?.word === i;
					// Rounded so server HTML and client hydration produce identical transform strings
					const baseRot = scatter ? round((seeded(i * 1.7 + 13) - 0.5) * 6) : 0;
					const baseY = scatter ? round((seeded(i * 2.9 + 31) - 0.5) * 0.3) : 0;
					const owner = owners[i] ?? null;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: words repeat and never reorder
						<span key={i}>
							<motion.span
								ref={(el) => {
									wordRefs.current[i] = el;
								}}
								className="inline-block whitespace-pre transition-colors"
								style={{
									color: owner !== null ? players[owner]?.color : undefined,
									transitionDuration: owner !== null ? "150ms" : "500ms",
								}}
								initial={false}
								animate={{
									transform: isPressed
										? `translateY(${round(baseY + 0.08)}em) rotate(${round(baseRot - 5)}deg) scale(0.88)`
										: `translateY(${baseY}em) rotate(${baseRot}deg) scale(1)`,
								}}
								transition={isPressed ? PRESS : DROP}
							>
								{word}
							</motion.span>
							{i < words.length - 1 && " "}
						</span>
					);
				})}
			</p>

			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 select-none"
			>
				{players.map((player, i) => {
					const cursor = cursors[i];
					const isPressing = !reduce && pressed?.player === i;
					return (
						<motion.div
							key={player.name}
							className="absolute top-0 left-0"
							initial={false}
							animate={{
								transform: cursor
									? `translate3d(${cursor.x}px, ${cursor.y}px, 0)`
									: "translate3d(-48px, -48px, 0)",
								opacity: cursor ? 1 : 0,
							}}
							transition={
								reduce
									? { duration: 0 }
									: {
											transform: { duration: TRAVEL_S, ease: EASE_IN_OUT },
											opacity: {
												duration: 0.3,
												ease: EASE_OUT,
												delay: i * 0.06,
											},
										}
							}
						>
							<motion.span
								className="block origin-[11px_6px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
								initial={false}
								animate={{
									transform: `rotate(${cursor?.rot ?? 0}deg) scale(${isPressing ? 0.9 : 1})`,
								}}
								transition={isPressing ? PRESS : SPRING}
							>
								<svg
									width="26"
									height="30"
									viewBox="0 0 26 30"
									fill="none"
									aria-hidden="true"
								>
									<path
										d={isPressing ? HAND_PRESS : HAND_POINT}
										fill={player.color}
										stroke="#141612"
										strokeWidth="1.75"
										strokeLinejoin="round"
										strokeLinecap="round"
									/>
									<path
										d="M12 17.5v4 M15 17.5v4 M18 17.5v4"
										stroke="#141612"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
							</motion.span>
							<span
								className="absolute top-6.5 left-4.5 rounded-full border-[1.5px] border-[#141612] px-2.5 py-0.5 text-xs font-bold tracking-[-0.01em] whitespace-nowrap text-[#141612] shadow-[0_2px_6px_-1px_rgba(0,0,0,0.25)]"
								style={{ backgroundColor: player.color }}
							>
								{player.name}
							</span>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
