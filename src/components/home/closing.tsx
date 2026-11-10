import { Link } from "@tanstack/react-router";
import { REPO_URL } from "#/components/shell/credits";
import { ZadaciLogo } from "#/components/zadaci-logo";
import { BTN_LG } from "./hero";
import { Reveal } from "./reveal";
import { StarButton } from "./star-button";

// Recent releases, written from the commit log (keep 4, newest first).
const CHANGES = [
	{
		date: "Nov 10, 2026",
		title: "GitHub comments, both ways",
		body: "Comments on a task appear on its issue, and replies on GitHub come back.",
	},
	{
		date: "Nov 10, 2026",
		title: "Project overview on phones",
		body: "The overview and its loading state now fill the whole phone screen.",
	},
	{
		date: "Nov 6, 2026",
		title: "Offline and update notices",
		body: "A bar says when you're offline, and offers a reload when a new version is out.",
	},
	{
		date: "Nov 6, 2026",
		title: "Quieter background tabs",
		body: "Tabs you aren't looking at stop reloading on every change.",
	},
];

const X_URL = "https://x.com/codewithmontana";

export function Changelog() {
	return (
		<section
			id="changelog"
			aria-labelledby="changelog-title"
			className="scroll-mt-14 border-t border-(color:--q-border)"
		>
			<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
				<h2
					id="changelog-title"
					className="text-[15px] font-medium text-(color:--q-text-3)"
				>
					What's new
				</h2>
				<ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-(color:--q-border) bg-(--q-border) sm:grid-cols-2 lg:grid-cols-4">
					{CHANGES.map((c, i) => (
						<Reveal
							as="li"
							key={c.title}
							delay={i * 0.06}
							className="bg-(--q-bg) p-5"
						>
							<span className="flex items-center gap-2 font-ibm-plex-mono text-[11px] text-(color:--q-text-4)">
								<span className="size-1.5 rounded-full bg-(--q-accent)" />
								{c.date}
							</span>
							<h3 className="mt-4 text-[15px] font-semibold tracking-tight">
								{c.title}
							</h3>
							<p className="mt-1.5 text-[13.5px] leading-relaxed text-(color:--q-text-3)">
								{c.body}
							</p>
						</Reveal>
					))}
				</ol>
			</div>
		</section>
	);
}

export function ClosingCta() {
	return (
		<section className="relative overflow-hidden border-t border-(color:--q-border)">
			<Reveal className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-28 md:flex-row md:items-end md:justify-between">
				<h2 className="text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-6xl">
					Made for teams.
					<br />
					<span className="text-(color:--q-text-4)">Free to use today.</span>
				</h2>
				<div className="flex flex-wrap items-center gap-3">
					<Link to="/auth/signin" className="btn btn-primary" style={BTN_LG}>
						Get started
					</Link>
					<StarButton style={BTN_LG} />
				</div>
			</Reveal>
		</section>
	);
}

const FOOTER = [
	{
		title: "Product",
		links: [
			{ label: "Plan", href: "#plan" },
			{ label: "Together", href: "#together" },
			{ label: "AI", href: "#ai" },
			{ label: "GitHub sync", href: "#github" },
		],
	},
	{
		title: "Company",
		links: [
			{ label: "Source code", href: REPO_URL, external: true },
			{ label: "X / Twitter", href: X_URL, external: true },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Terms", href: "/terms" },
			{ label: "Privacy", href: "/privacy" },
		],
	},
];

export function LandingFooter() {
	return (
		<footer className="border-t border-(color:--q-border)">
			<div className="mx-auto grid max-w-6xl grid-cols-3 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
				<div className="col-span-3 flex flex-col gap-3 md:col-span-1">
					<span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
						<ZadaciLogo className="size-6" />
						Zadaci
					</span>
					<div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-(length:--q-fs-sm) text-(color:--q-text-3)">
						<p>&copy; {new Date().getFullYear()} &middot; Made with 💚 by</p>
						<a
							href={X_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="group flex items-center gap-x-1 rounded-sm"
						>
							<img
								src="https://avatars.githubusercontent.com/u/63234437?v=4"
								alt=""
								width={20}
								height={20}
								loading="lazy"
								className="size-5 rounded-full"
							/>
							<span className="decoration-brand decoration-wavy group-hover:underline">
								@codewithmontana
							</span>
						</a>
					</div>
				</div>
				{FOOTER.map((col) => (
					<nav key={col.title} aria-label={col.title}>
						<h3 className="text-(length:--q-fs-sm) font-medium">{col.title}</h3>
						<ul className="mt-3 flex flex-col gap-2 text-(length:--q-fs) text-(color:--q-text-3)">
							{col.links.map((l) => (
								<li key={l.label}>
									<a
										href={l.href}
										{...("external" in l
											? { target: "_blank", rel: "noopener noreferrer" }
											: {})}
										className="transition-colors hover:text-(color:--q-text)"
									>
										{l.label}
									</a>
								</li>
							))}
						</ul>
					</nav>
				))}
			</div>
		</footer>
	);
}
