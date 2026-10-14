import { useEffect, useRef, useState } from "react";
import type { ToastType } from "#/lib/toast";

export const LOOK: Record<
	ToastType,
	{ tint: string; deep: string; accent: string }
> = {
	success: { tint: "#5BD79C", deep: "#22A56E", accent: "#48CE8D" },
	error: { tint: "#F5897F", deep: "#DA463A", accent: "#F0736A" },
	info: { tint: "#93B9FF", deep: "#5B84E6", accent: "#93B9FF" },
	pending: { tint: "#8C8C84", deep: "#5C5C55", accent: "#A2A29A" },
};

const PX_COLS = 36;
const PX_ROWS = 2;
const ROWS = Array.from({ length: PX_ROWS }, (_, r) => r);
const COLS = Array.from({ length: PX_COLS }, (_, c) => c);

const clamp = (n: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, n));

function ramp(a: string, b: string, t: number, k: number) {
	const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
	const B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
	const c = A.map((v, i) => clamp((v + (B[i] - v) * t) * k, 0, 255) | 0);
	return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function jitter(r: number, c: number) {
	const h = ((r * 73856093) ^ (c * 19349663)) >>> 0;
	return (h % 1000) / 1000;
}

export function PixelTimer({
	type,
	duration,
	paused,
	reduce,
	onDone,
}: {
	type: ToastType;
	duration: number;
	paused: boolean;
	reduce: boolean;
	onDone: () => void;
}) {
	const [spent, setSpent] = useState(0);
	// Refs so the rAF loop reads live values without restarting.
	const pausedRef = useRef(paused);
	pausedRef.current = paused;
	const doneRef = useRef(onDone);
	doneRef.current = onDone;

	useEffect(() => {
		if (reduce) return;
		let raf = 0;
		let prev = performance.now();
		let elapsed = 0;
		const loop = (now: number) => {
			const dt = now - prev;
			prev = now;
			if (!pausedRef.current) elapsed += dt;
			const p = Math.min(1, elapsed / duration);
			setSpent(Math.floor(p * PX_COLS));
			if (p >= 1) {
				doneRef.current();
				return;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [reduce, duration]);

	const l = LOOK[type];

	return (
		<div
			aria-hidden="true"
			className="grid gap-0.5 px-3 pt-0.5 pb-2.5"
			style={{
				gridTemplateColumns: `repeat(${PX_COLS}, minmax(0, 1fr))`,
				gridAutoRows: "3.5px",
			}}
		>
			{ROWS.map((r) =>
				COLS.map((c) => {
					const j = jitter(r, c);
					const style =
						c >= spent
							? {
									background: ramp(
										l.deep,
										l.tint,
										c / (PX_COLS - 1),
										0.68 + 0.52 * j,
									),
									opacity: 0.6 + 0.4 * j,
								}
							: { background: "var(--tst-px-off)", opacity: 0.5 + 0.5 * j };
					return (
						<span
							key={`${r}-${c}`}
							className="h-[3.5px] rounded-[1px]"
							style={style}
						/>
					);
				}),
			)}
		</div>
	);
}
