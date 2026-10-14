import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { type ToastData, type ToastPosition, toast } from "#/lib/toast";
import { type Layout, ToastCard } from "./toast-card";

const GAP = 12;
const PEEK = 15;
const FALLBACK_H = 78;

export function ToastStack({
	toasts,
	position,
	reduce,
}: {
	toasts: ToastData[];
	position: ToastPosition;
	reduce: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const [heights, setHeights] = useState<Record<number, number>>({});
	const isBottom = position.startsWith("bottom");

	const onHeight = useCallback((id: number, h: number) => {
		setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
	}, []);

	useEffect(() => {
		if (toasts.length <= 1) setExpanded(false);
	}, [toasts.length]);

	const heightOf = (t: ToastData) => heights[t.id] ?? FALLBACK_H;
	const frontH = toasts[0] ? heightOf(toasts[0]) : FALLBACK_H;
	const dir = isBottom ? -1 : 1;

	let acc = 0;
	const layouts: Layout[] = toasts.map((t, i) => {
		const expandedY = acc;
		acc += heightOf(t) + GAP;
		const depth = Math.min(i, 2);
		return {
			ty: expanded ? dir * expandedY : dir * depth * PEEK,
			s: expanded ? 1 : 1 - depth * 0.05,
			o: expanded || i < 3 ? 1 : 0,
			contentShown: expanded || i === 0,
			z: 100 - i,
		};
	});
	const wrapH = expanded ? Math.max(acc - GAP, frontH) : frontH + 2 * PEEK;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover only expands the stack and pauses timers
		<div
			className="pointer-events-auto relative w-95 max-w-[calc(100vw-3rem)]"
			style={{
				height: toasts.length ? `${wrapH}px` : "0px",
				transition: "height 0.34s cubic-bezier(0.23,1,0.32,1)",
			}}
			onMouseEnter={() => toasts.length > 1 && setExpanded(true)}
			onMouseLeave={() => setExpanded(false)}
		>
			<AnimatePresence>
				{toasts.map((t, i) => (
					<ToastCard
						key={t.id}
						t={t}
						layout={layouts[i]}
						paused={expanded}
						reduce={reduce}
						isBottom={isBottom}
						onHeight={onHeight}
						onClose={() => toast.dismiss(t.id)}
					/>
				))}
			</AnimatePresence>
		</div>
	);
}
