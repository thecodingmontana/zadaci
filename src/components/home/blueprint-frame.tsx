import type { CSSProperties } from "react";
import { cn } from "#/lib/utils";

const EO = "cubic-bezier(0.23, 1, 0.32, 1)";
const LINE = "color-mix(in srgb, var(--bp) 10%, transparent)";
const CROSS_LINE = "color-mix(in srgb, var(--bp) 50%, transparent)";
const HATCH =
	"repeating-linear-gradient(-63deg, color-mix(in srgb, var(--bp) 12%, transparent) 0, color-mix(in srgb, var(--bp) 12%, transparent) 1px, transparent 1px, transparent 14px)";

const BAND_H = 72;
const GAP = 40;
const TOP_TOP = `${GAP}px`;
const TOP_BOT = `${GAP + BAND_H}px`;
const BOT_TOP = `calc(100% - ${GAP + BAND_H}px)`;
const BOT_BOT = `calc(100% - ${GAP}px)`;

/** Decorative blueprint lines that draw in around the hero; pure CSS so it stays smooth while the page hydrates. */
export function BlueprintFrame({
	color = "#ffffff",
	inset = 48,
	speed = 1,
	className,
}: {
	color?: string;
	inset?: number;
	speed?: number;
	className?: string;
}) {
	const left = `${inset}px`;
	const right = `calc(100% - ${inset}px)`;
	const drift =
		speed > 0 ? `, bp-drift ${7 / speed}s linear 1040ms infinite` : "";
	const crosses = [TOP_TOP, TOP_BOT, BOT_TOP, BOT_BOT].flatMap((y) => [
		{ x: left, y },
		{ x: right, y },
	]);

	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 overflow-hidden select-none",
				className,
			)}
			style={{ "--bp": color } as CSSProperties}
		>
			<div
				className="bp-anim absolute inset-y-0 w-px"
				style={{
					left,
					background: LINE,
					animation: `bp-draw-y 720ms ${EO} both`,
				}}
			/>
			<div
				className="bp-anim absolute inset-y-0 w-px"
				style={{
					left: right,
					background: LINE,
					animation: `bp-draw-y 720ms ${EO} 90ms both`,
				}}
			/>
			{[TOP_TOP, BOT_TOP].map((top) => (
				<div
					key={top}
					className="bp-anim absolute overflow-hidden"
					style={{
						left,
						right: left,
						top,
						height: BAND_H,
						backgroundImage: HATCH,
						animation: `bp-band-in 700ms ${EO} 340ms both${drift}`,
					}}
				/>
			))}
			{[TOP_TOP, TOP_BOT, BOT_TOP, BOT_BOT].map((top, i) => (
				<div
					key={top}
					className="bp-anim absolute inset-x-0 h-px"
					style={{
						top,
						background: LINE,
						animation: `bp-draw-x 620ms ${EO} ${240 + i * 70}ms both`,
					}}
				/>
			))}
			{crosses.map((c, i) => (
				<div
					key={`${c.x}-${c.y}`}
					className="bp-cross absolute size-3.5"
					style={{
						left: c.x,
						top: c.y,
						transform: "translate(-50%, -50%)",
						animation: `bp-cross-in 450ms ${EO} ${720 + i * 45}ms both`,
					}}
				>
					<span
						className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2"
						style={{ background: CROSS_LINE }}
					/>
					<span
						className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2"
						style={{ background: CROSS_LINE }}
					/>
				</div>
			))}
		</div>
	);
}
