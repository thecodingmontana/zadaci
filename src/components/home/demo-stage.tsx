import { useReducedMotion } from "motion/react";
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/**
 * A piece of the real app UI at the app's own density. `fluid` content reflows to the box (up to
 * `width`) the way the app does on a phone. Otherwise it is drawn at `width` and scales down no
 * further than `minScale`; past that it pans, like a phone board scrolling to a column (`pan`, in
 * stage px). The box's height comes from CSS alone (aspect ratio with a floor), so nothing shifts.
 */
export function Stage({
	width,
	height,
	label,
	children,
	stageRef,
	fluid = false,
	minScale = 0.8,
	pan = 0,
}: {
	width: number;
	height: number;
	label: string;
	children: ReactNode | ((w: number) => ReactNode);
	stageRef?: RefObject<HTMLDivElement | null>;
	fluid?: boolean;
	minScale?: number;
	pan?: number;
}) {
	const box = useRef<HTMLDivElement>(null);
	const [boxW, setBoxW] = useState(width);
	useLayoutEffect(() => {
		const el = box.current;
		if (!el) return;
		const fit = () => setBoxW(el.clientWidth);
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);
	const w = fluid ? Math.min(width, boxW) : width;
	const scale = fluid ? 1 : Math.min(1, Math.max(minScale, boxW / width));
	const maxPan = Math.max(0, width - boxW / scale);
	const x = Math.min(maxPan, Math.max(0, pan));
	return (
		<div
			ref={box}
			role="img"
			aria-label={label}
			className="relative mx-auto w-full overflow-hidden rounded-(--q-r-lg) border border-(color:--q-border) bg-(--q-bg) text-(length:--q-fs) text-(color:--q-text)"
			style={
				fluid
					? { maxWidth: width, height }
					: {
							maxWidth: width,
							aspectRatio: `${width} / ${height}`,
							minHeight: height * minScale,
						}
			}
		>
			<div
				ref={stageRef}
				aria-hidden="true"
				inert
				className="absolute top-0 left-0 origin-top-left transition-transform duration-650 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
				style={{
					width: w,
					height,
					transform: `scale(${scale}) translateX(${-x}px)`,
				}}
			>
				{typeof children === "function" ? children(w) : children}
			</div>
		</div>
	);
}

/** True while the element is on screen and the tab is visible. */
export function useActive(ref: RefObject<HTMLElement | null>) {
	const [seen, setSeen] = useState(false);
	const [visible, setVisible] = useState(true);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([e]) => setSeen(e?.isIntersecting ?? false),
			{ threshold: 0.3 },
		);
		io.observe(el);
		const onVis = () => setVisible(document.visibilityState === "visible");
		onVis();
		document.addEventListener("visibilitychange", onVis);
		return () => {
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, [ref]);
	return seen && visible;
}

export type Wait = (ms: number) => Promise<void>;

/**
 * Plays `script` over and over while the demo is on screen; it stops (and starts over from
 * `reset`) when scrolled away or the tab is hidden. With reduced motion only `end` runs: the
 * static final state.
 */
export function useDemoLoop(
	ref: RefObject<HTMLElement | null>,
	script: (wait: Wait) => Promise<void>,
	reset: () => void,
	end: () => void,
) {
	const active = useActive(ref);
	const reduce = useReducedMotion() ?? false;
	const fns = useRef({ script, reset, end });
	fns.current = { script, reset, end };

	useEffect(() => {
		if (reduce) {
			fns.current.end();
			return;
		}
		if (!active) return;
		let cancelled = false;
		const timers = new Set<ReturnType<typeof setTimeout>>();
		const wait: Wait = (ms) =>
			new Promise((resolve, reject) => {
				const id = setTimeout(() => {
					timers.delete(id);
					cancelled ? reject(new Error("stopped")) : resolve();
				}, ms);
				timers.add(id);
			});
		(async () => {
			while (!cancelled) {
				fns.current.reset();
				await fns.current.script(wait);
			}
		})().catch(() => {}); // "stopped": the loop was cancelled on purpose
		return () => {
			cancelled = true;
			for (const id of timers) clearTimeout(id);
		};
	}, [active, reduce]);

	return reduce;
}

/** Where a child element sits inside the stage, in stage pixels (unscaled). */
export function spot(
	stage: HTMLElement | null,
	el: Element | null | undefined,
): { x: number; y: number; w: number; h: number } | null {
	if (!stage || !el) return null;
	const s = stage.getBoundingClientRect();
	const r = el.getBoundingClientRect();
	const k = s.width / stage.offsetWidth || 1;
	return {
		x: (r.left - s.left) / k,
		y: (r.top - s.top) / k,
		w: r.width / k,
		h: r.height / k,
	};
}
