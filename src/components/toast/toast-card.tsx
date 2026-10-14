import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { ToastData, ToastType } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { LOOK, PixelTimer } from "./pixel-timer";

const EASE = [0.23, 1, 0.32, 1] as const;

const ICON: Record<ToastType, string> = {
	success: "icon-[solar--check-linear] size-[19px]",
	error: "icon-[solar--danger-triangle-linear] size-[19px]",
	info: "icon-[hugeicons--diamond] size-[17px]",
	pending: "icon-[hugeicons--loading-03] size-[19px]",
};

export interface Layout {
	ty: number;
	s: number;
	o: number;
	contentShown: boolean;
	z: number;
}

const tf = (y: number, s: number) => `translateY(${y}px) scale(${s})`;

export function ToastCard({
	t,
	layout,
	paused,
	reduce,
	isBottom,
	onHeight,
	onClose,
}: {
	t: ToastData;
	layout: Layout;
	paused: boolean;
	reduce: boolean;
	isBottom: boolean;
	onHeight: (id: number, h: number) => void;
	onClose: () => void;
}) {
	const measure = useRef<HTMLDivElement>(null);
	const onHeightRef = useRef(onHeight);
	onHeightRef.current = onHeight;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		const el = measure.current;
		if (!el) return;
		const report = () => onHeightRef.current(t.id, el.offsetHeight);
		report();
		const ro = new ResizeObserver(report);
		ro.observe(el);
		return () => ro.disconnect();
	}, [t.id]);

	// Plain setTimeout dismiss when animations are off (the pixel timer doesn't run then).
	useEffect(() => {
		if (!reduce || t.type === "pending" || !t.duration) return;
		const id = window.setTimeout(() => onCloseRef.current(), t.duration);
		return () => window.clearTimeout(id);
	}, [reduce, t.type, t.duration]);

	const timed = t.type !== "pending" && !!t.duration;
	const l = LOOK[t.type];
	const off = isBottom ? 1 : -1;

	return (
		<motion.div
			className={cn("absolute inset-x-0", isBottom ? "bottom-0" : "top-0")}
			style={{
				zIndex: layout.z,
				transformOrigin: isBottom ? "50% 100%" : "50% 0%",
			}}
			initial={
				reduce
					? { opacity: 0 }
					: {
							opacity: 0,
							transform: tf(layout.ty + off * 26, 0.9),
							filter: "blur(8px)",
						}
			}
			animate={
				reduce
					? { opacity: layout.o }
					: {
							opacity: layout.o,
							transform: tf(layout.ty, layout.s),
							filter: "blur(0px)",
						}
			}
			exit={
				reduce
					? { opacity: 0 }
					: {
							opacity: 0,
							transform: tf(layout.ty + off * 12, 0.92),
							filter: "blur(6px)",
						}
			}
			transition={{ duration: 0.34, ease: EASE }}
		>
			<div ref={measure}>
				<div
					className="rounded-[18px] p-1.25"
					style={{
						background: "var(--tst-bezel)",
						boxShadow: "var(--tst-bezel-shadow)",
					}}
				>
					<div
						className="relative overflow-hidden rounded-[14px]"
						style={{
							background: "var(--tst-panel)",
							boxShadow: "var(--tst-panel-inset)",
						}}
					>
						<div
							className="flex items-stretch transition-opacity duration-200"
							style={{
								opacity: layout.contentShown ? 1 : 0,
								pointerEvents: layout.contentShown ? "auto" : "none",
							}}
						>
							<div className="flex min-w-0 flex-1 items-center gap-3 p-3">
								<span className="relative">
									<AnimatePresence mode="wait" initial={false}>
										<motion.span
											key={t.type}
											initial={
												reduce ? false : { opacity: 0, transform: "scale(0.5)" }
											}
											animate={{ opacity: 1, transform: "scale(1)" }}
											exit={
												reduce
													? { opacity: 0 }
													: { opacity: 0, transform: "scale(0.5)" }
											}
											transition={{ duration: 0.22, ease: EASE }}
											className="block"
										>
											<span
												aria-hidden="true"
												className="grid size-7.5 shrink-0 place-items-center"
												style={{ color: l.accent }}
											>
												<span
													className={cn(
														ICON[t.type],
														t.type === "pending" && !reduce && "tst-spin",
													)}
												/>
											</span>
										</motion.span>
									</AnimatePresence>
								</span>

								<div className="min-w-0 flex-1">
									<p
										className="truncate font-medium text-[13px] leading-tight"
										style={{ color: "var(--tst-text)" }}
									>
										{t.title}
									</p>
									{t.desc && (
										<p
											className="mt-0.5 truncate text-[11px] leading-tight"
											style={{ color: "var(--tst-mute)" }}
										>
											{t.desc}
										</p>
									)}
								</div>

								<button
									type="button"
									aria-label="Dismiss"
									className="mt-px grid size-6 shrink-0 place-items-center rounded-[7px] text-[13px] leading-none outline-none transition-[color,transform] duration-100 hover:text-(--tst-mute) focus-visible:ring-2 focus-visible:ring-(--tst-line) active:scale-90 motion-reduce:active:scale-100"
									style={{ color: "var(--tst-faint)" }}
									onClick={onClose}
								>
									✕
								</button>
							</div>

							{t.action && (
								<button
									type="button"
									className="flex shrink-0 items-center gap-1.5 px-4 font-medium text-[11.5px] outline-none transition-[background-color,transform] duration-100 hover:[background:var(--tst-well)] focus-visible:[background:var(--tst-well)] active:scale-[0.98] motion-reduce:active:scale-100"
									style={{
										color: "var(--tst-text)",
										borderLeft: "1px solid var(--tst-line)",
										background: "transparent",
									}}
									onClick={() => {
										t.action?.onClick?.();
										onClose();
									}}
								>
									{t.action.icon && (
										<span
											aria-hidden="true"
											className="grid size-3.5 place-items-center"
											style={{ color: l.accent }}
										>
											{t.action.icon}
										</span>
									)}
									{t.action.label}
								</button>
							)}
						</div>

						{timed && (
							<div
								className="transition-opacity duration-200"
								style={{ opacity: layout.contentShown ? 1 : 0 }}
							>
								<PixelTimer
									key={t.duration}
									type={t.type}
									duration={t.duration}
									paused={paused}
									reduce={reduce}
									onDone={onClose}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</motion.div>
	);
}
