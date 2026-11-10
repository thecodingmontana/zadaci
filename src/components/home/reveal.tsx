import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SHOWN = { opacity: 1, transform: "translateY(0px)" };

/** Fades and lifts its children in the first time they scroll into view (fade only with reduced motion). */
export function Reveal({
	children,
	delay = 0,
	className,
	as = "div",
	immediate = false,
}: {
	children: ReactNode;
	delay?: number;
	className?: string;
	as?: "div" | "li" | "section";
	/** above the fold: play on mount instead of waiting to scroll into view */
	immediate?: boolean;
}) {
	const reduce = useReducedMotion();
	const Tag = motion[as];
	return (
		<Tag
			className={className}
			initial={{ opacity: 0, transform: reduce ? "none" : "translateY(14px)" }}
			animate={immediate ? SHOWN : undefined}
			whileInView={immediate ? undefined : SHOWN}
			viewport={{ once: true, margin: "0px 0px -80px 0px" }}
			transition={{ duration: 0.7, delay, ease: EASE_OUT }}
		>
			{children}
		</Tag>
	);
}

/** A real Zadaci screenshot: the light capture in light mode, the dark one in dark mode. */
export function Shot({
	name,
	alt,
	className,
	priority = false,
}: {
	name: string;
	alt: string;
	className?: string;
	priority?: boolean;
}) {
	const common = {
		width: 1440,
		height: 823,
		decoding: "async" as const,
		loading: priority ? ("eager" as const) : ("lazy" as const),
		fetchPriority: priority ? ("high" as const) : undefined,
	};
	return (
		<>
			<img
				{...common}
				src={`/landing/${name}-light.webp`}
				alt={alt}
				className={`${className ?? ""} block h-auto w-full dark:hidden`}
			/>
			<img
				{...common}
				src={`/landing/${name}-dark.webp`}
				alt={alt}
				className={`${className ?? ""} hidden h-auto w-full dark:block`}
			/>
		</>
	);
}
