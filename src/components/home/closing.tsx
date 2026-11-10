import { Link } from "@tanstack/react-router";
import { REPO_URL } from "#/components/shell/credits";
import { ZadaciLogo } from "#/components/zadaci-logo";
import { Reveal } from "./reveal";

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
			className="scroll-mt-14 border-t border-black/[0.07] dark:border-white/[0.07]"
		>
			<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
				<h2
					id="changelog-title"
					className="text-[15px] font-medium text-black/45 dark:text-white/40"
				>
					What's new
				</h2>
				<ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-black/[0.07] bg-black/[0.07] sm:grid-cols-2 lg:grid-cols-4 dark:border-white/[0.07] dark:bg-white/[0.07]">
					{CHANGES.map((c, i) => (
						<Reveal
							as="li"
							key={c.title}
							delay={i * 0.06}
							className="bg-[#fbfaf8] p-5 dark:bg-[#0b0b0c]"
						>
							<span className="flex items-center gap-2 font-ibm-plex-mono text-[11px] text-black/40 dark:text-white/35">
								<span className="size-1.5 rounded-full bg-[#F97452]" />
								{c.date}
							</span>
							<h3 className="mt-4 text-[15px] font-semibold tracking-tight">
								{c.title}
							</h3>
							<p className="mt-1.5 text-[13.5px] leading-relaxed text-black/55 dark:text-white/50">
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
		<section className="relative overflow-hidden border-t border-black/[0.07] dark:border-white/[0.07]">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 -bottom-40 mx-auto h-80 max-w-3xl rounded-full bg-[radial-gradient(closest-side,rgba(249,116,82,0.18),transparent)] blur-2xl"
			/>
			<Reveal className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-24 sm:px-6 sm:py-36 md:flex-row md:items-end md:justify-between">
				<h2 className="text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-6xl">
					Made for teams.
					<br />
					<span className="text-black/40 dark:text-white/35">
						Free to use today.
					</span>
				</h2>
				<div className="flex flex-wrap items-center gap-3">
					<Link
						to="/auth/signin"
						className="rounded-full bg-[#121212] px-5 py-2.5 text-[14.5px] font-medium text-white transition-transform duration-150 ease-out active:scale-[0.97] dark:bg-white dark:text-[#121212]"
					>
						Get started
					</Link>
					<a
						href={REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-[14.5px] font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-black/[0.03] active:scale-[0.97] dark:border-white/15 dark:hover:bg-white/[0.05]"
					>
						<span
							aria-hidden="true"
							className="icon-[simple-icons--github] size-4"
						/>
						Star on GitHub
					</a>
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
			{ label: "Changelog", href: "#changelog" },
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
		<footer className="border-t border-black/[0.07] dark:border-white/[0.07]">
			<div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
				<div className="flex flex-col gap-4">
					<span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
						<ZadaciLogo className="size-6" />
						Zadaci
					</span>
					<div className="flex items-center gap-x-1 text-[13.5px] text-black/55 dark:text-white/50">
						<p>&copy; {new Date().getFullYear()} &middot; Made with 💚,</p>
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
						<h3 className="text-[13px] font-medium">{col.title}</h3>
						<ul className="mt-3 flex flex-col gap-2 text-[13.5px] text-black/55 dark:text-white/50">
							{col.links.map((l) => (
								<li key={l.label}>
									<a
										href={l.href}
										{...("external" in l
											? { target: "_blank", rel: "noopener noreferrer" }
											: {})}
										className="transition-colors hover:text-black dark:hover:text-white"
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
