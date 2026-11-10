import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";

/** One feature chapter: heading left, story right, a wide product panel, then its feature list. */
export function Chapter({
	id,
	title,
	body,
	features,
	children,
}: {
	id: string;
	title: [string, string];
	body: string;
	features: string[];
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className="scroll-mt-14 border-t border-black/[0.07] dark:border-white/[0.07]"
		>
			<div className="mx-auto max-w-6xl px-4 pt-24 pb-20 sm:px-6 sm:pt-32">
				<div className="grid gap-6 md:grid-cols-2 md:gap-12">
					<Reveal>
						<h2
							id={`${id}-title`}
							className="text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl"
						>
							{title[0]}
							<br />
							{title[1]}
						</h2>
					</Reveal>
					<Reveal delay={0.08}>
						<p className="text-[17px] leading-relaxed text-pretty text-black/60 sm:text-[19px] dark:text-white/55">
							{body}
						</p>
						<Link
							to="/auth/signin"
							className="group mt-6 inline-flex items-center gap-1.5 text-[14.5px] font-medium"
						>
							Try it free
							<span
								aria-hidden="true"
								className="icon-[solar--arrow-right-linear] size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
							/>
						</Link>
					</Reveal>
				</div>

				<Reveal delay={0.1} className="relative mt-14 sm:mt-20">
					{children}
				</Reveal>

				<Reveal className="mt-14 grid gap-4 text-[14.5px] sm:mt-20 md:grid-cols-2">
					<span className="text-black/40 dark:text-white/35">Features</span>
					<ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
						{features.map((f) => (
							<li
								key={f}
								className="flex items-center gap-1.5 text-black/65 dark:text-white/60"
							>
								{f}
								<span
									aria-hidden="true"
									className="icon-[solar--add-circle-linear] size-3.5 opacity-50"
								/>
							</li>
						))}
					</ul>
				</Reveal>
			</div>
		</section>
	);
}

/** A soft bordered panel for product UI, its edges fading into the page. */
export function Panel({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`relative overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-[#141416] dark:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] ${className}`}
		>
			{children}
		</div>
	);
}

/** Fades the bottom (and optionally right) of a panel into the page colour. */
export function EdgeFade({ right = false }: { right?: boolean }) {
	return (
		<>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-[#fbfaf8] dark:to-[#0b0b0c]"
			/>
			{right && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-r from-transparent to-[#fbfaf8] dark:to-[#0b0b0c]"
				/>
			)}
		</>
	);
}
