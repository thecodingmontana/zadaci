import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import {
	getServerSnapshot,
	getSnapshot,
	subscribe,
	type ToastData,
	type ToastPosition,
} from "#/lib/toast";
import { cn } from "#/lib/utils";
import { ToastStack } from "./toast-stack";

const ALL_POSITIONS: ToastPosition[] = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];

const ANCHOR: Record<ToastPosition, string> = {
	"top-left": "items-start justify-start",
	"top-center": "items-start justify-center",
	"top-right": "items-start justify-end",
	"bottom-left": "items-end justify-start",
	"bottom-center": "items-end justify-center",
	"bottom-right": "items-end justify-end",
};

export function Toaster({
	max = 5,
	position = "bottom-right",
	className,
}: {
	max?: number;
	position?: ToastPosition;
	className?: string;
}) {
	const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	const reduce = useReducedMotion() ?? false;

	const groups: Partial<Record<ToastPosition, ToastData[]>> = {};
	for (const t of list) {
		const pos = t.position ?? position;
		groups[pos] ??= [];
		groups[pos].push(t);
	}

	return (
		<>
			{/* Always-mounted live regions so screen readers announce additions and updates. */}
			<output aria-live="polite" className="sr-only">
				{list
					.filter((t) => t.type !== "error")
					.map((t) => (
						<span key={t.id} className="block">
							{t.title}
							{t.desc ? `. ${t.desc}` : ""}
						</span>
					))}
			</output>
			<output role="alert" aria-live="assertive" className="sr-only">
				{list
					.filter((t) => t.type === "error")
					.map((t) => (
						<span key={t.id} className="block">
							{t.title}
							{t.desc ? `. ${t.desc}` : ""}
						</span>
					))}
			</output>
			{ALL_POSITIONS.map((pos) => {
				const toasts = groups[pos]?.slice(0, max);
				if (!toasts?.length) return null;
				return (
					<section
						key={pos}
						aria-label="Notifications"
						className={cn(
							"tst-root pointer-events-none fixed inset-0 z-100 flex p-4 sm:p-6",
							ANCHOR[pos],
							className,
						)}
					>
						<ToastStack toasts={toasts} position={pos} reduce={reduce} />
					</section>
				);
			})}
		</>
	);
}
