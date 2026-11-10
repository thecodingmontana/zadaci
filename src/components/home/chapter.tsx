import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { type Feature, FeatureList } from "./feature-list";
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
	features: Feature[];
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className="scroll-mt-14 border-t border-(color:--q-border)"
		>
			<div className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20 lg:pt-28">
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
						<p className="text-[17px] leading-relaxed text-pretty text-(color:--q-text-2) sm:text-[19px]">
							{body}
						</p>
						<Link to="/auth/signin" className="group btn btn-secondary mt-6">
							Try it free
							<span
								aria-hidden="true"
								className="icon-[solar--arrow-right-linear] size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
							/>
						</Link>
					</Reveal>
				</div>

				<Reveal delay={0.1} className="relative mt-10 sm:mt-14">
					{children}
				</Reveal>

				<Reveal className="mt-10 grid gap-3 sm:mt-14 md:grid-cols-[1fr_2fr] md:gap-12">
					<h3 className="text-(length:--q-fs) font-normal text-(color:--q-text-4)">
						Features
					</h3>
					<FeatureList id={id} features={features} />
				</Reveal>
			</div>
		</section>
	);
}

/** A bordered frame for a screenshot, with the app's own border and radius tokens. */
export function Panel({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`relative overflow-hidden rounded-(--q-r-lg) border border-(color:--q-border) bg-(--q-bg) ${className}`}
		>
			{children}
		</div>
	);
}
