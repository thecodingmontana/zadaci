import { type CSSProperties, Fragment, type ReactNode } from "react";
import { cn } from "#/lib/utils";

// Text and block reveals for the landing page, all in CSS (src/styles.css, "Landing reveals"):
// on scroll they ride a view timeline, so they need no JavaScript and can never stay hidden;
// browsers without scroll timelines, and reduced motion, simply show everything.

/** Fades and lifts its children in as they scroll into view; `delay` (s) staggers siblings. */
export function Reveal({
	children,
	delay = 0,
	className,
	as: Tag = "div",
	immediate = false,
}: {
	children: ReactNode;
	delay?: number;
	className?: string;
	as?: "div" | "li" | "section";
	/** above the fold: play once on first paint instead of on scroll */
	immediate?: boolean;
}) {
	return (
		<Tag
			className={cn(immediate ? "lp-enter" : "lp-reveal", className)}
			style={{ "--i": delay * 10 } as CSSProperties}
		>
			{children}
		</Tag>
	);
}

/** A heading whose lines rise one after another from behind a mask. */
export function RiseLines({
	lines,
	id,
	className,
	as: Tag = "h2",
}: {
	lines: ReactNode[];
	id?: string;
	className?: string;
	as?: "h2" | "h3";
}) {
	return (
		<Tag id={id} className={className}>
			{lines.map((line, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed lines
				<Fragment key={i}>
					{/* the lines are blocks: without a space, search engines and screen readers read "Plan ityour way" */}
					{i > 0 && " "}
					<span className="lp-line">
						<span className="lp-rise" style={{ "--i": i } as CSSProperties}>
							{line}
						</span>
					</span>
				</Fragment>
			))}
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
