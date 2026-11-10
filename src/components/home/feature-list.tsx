import { useReducedMotion } from "motion/react";
import { type KeyboardEvent, useRef, useState } from "react";
import { cn } from "#/lib/utils";
import { useActive } from "./demo-stage";

export type Feature = { name: string; desc: string };

/**
 * A chapter's features as rows that open themselves in turn: each shows its one-line description
 * for 4s (a brand line fills along the bottom), then the next. Clicking a row jumps there; hover,
 * focus, scrolling away or a hidden tab pause it. With reduced motion every row stays open.
 */
export function FeatureList({
	id,
	features,
}: {
	id: string;
	features: Feature[];
}) {
	const list = useRef<HTMLUListElement>(null);
	const visible = useActive(list);
	const reduce = useReducedMotion();
	const [open, setOpen] = useState(0);
	const [held, setHeld] = useState(false);
	// bumped on a click so the same row's timer starts over
	const [round, setRound] = useState(0);
	const playing = visible && !held;

	const onKey = (e: KeyboardEvent) => {
		const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const buttons = [...(list.current?.querySelectorAll("button") ?? [])];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		buttons[(at + step + buttons.length) % buttons.length]?.focus();
	};

	return (
		<ul
			ref={list}
			className="grid border-t border-(color:--q-divider)"
			onKeyDown={onKey}
			onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
			onPointerLeave={() => setHeld(false)}
			onFocus={() => setHeld(true)}
			onBlur={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
			}}
		>
			{features.map((f, i) => {
				const on = reduce || open === i;
				const panel = `${id}-f${i}`;
				return (
					<li
						key={f.name}
						className="relative border-b border-(color:--q-divider)"
					>
						<button
							type="button"
							aria-expanded={on}
							aria-controls={panel}
							onClick={() => {
								setOpen(i);
								setRound((r) => r + 1);
							}}
							className={cn(
								"flex min-h-11 w-full items-center gap-3 py-2.5 text-start text-(length:--q-fs-md) transition-colors duration-150",
								on
									? "text-(color:--q-text)"
									: "text-(color:--q-text-3) hover:text-(color:--q-text)",
							)}
						>
							<span className="min-w-0 flex-1">{f.name}</span>
							<span
								aria-hidden="true"
								className={cn(
									"icon-[hugeicons--plus-sign] size-3.5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
									on
										? "rotate-45 text-(color:--q-text)"
										: "text-(color:--q-text-4)",
								)}
							/>
						</button>
						<div
							id={panel}
							aria-hidden={!on}
							inert={!on}
							className={cn(
								"grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
								on
									? "grid-rows-[1fr] opacity-100"
									: "grid-rows-[0fr] opacity-0",
							)}
						>
							<p className="overflow-hidden text-(length:--q-fs) leading-relaxed text-(color:--q-text-3)">
								<span className="block min-h-[3em] pb-3 pe-8">{f.desc}</span>
							</p>
						</div>
						{!reduce && open === i && (
							<span
								key={round}
								aria-hidden="true"
								className="lp-progress absolute inset-x-0 -bottom-px h-px origin-left bg-(--q-accent)"
								style={{ animationPlayState: playing ? "running" : "paused" }}
								onAnimationEnd={() => setOpen((o) => (o + 1) % features.length)}
							/>
						)}
					</li>
				);
			})}
		</ul>
	);
}
