import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "#/components/theme-toggle";
import { ZadaciLogo } from "#/components/zadaci-logo";

const LINKS = [
	{ href: "#plan", label: "Plan" },
	{ href: "#together", label: "Together" },
	{ href: "#ai", label: "AI" },
	{ href: "#github", label: "GitHub" },
	{ href: "#changelog", label: "Changelog" },
];

export function LandingNav() {
	return (
		<header className="sticky top-0 z-40 border-b border-black/[0.07] bg-[#fbfaf8]/80 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#0b0b0c]/75">
			<nav
				aria-label="Main"
				className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6"
			>
				<a
					href="#top"
					className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight"
				>
					<ZadaciLogo className="size-6" />
					Zadaci
				</a>
				<ul className="ml-auto hidden items-center gap-6 text-[13.5px] text-black/60 md:flex dark:text-white/55">
					{LINKS.map((l) => (
						<li key={l.href}>
							<a
								href={l.href}
								className="transition-colors duration-150 hover:text-black dark:hover:text-white"
							>
								{l.label}
							</a>
						</li>
					))}
				</ul>
				<div className="ml-auto flex items-center gap-2 md:ml-0 md:border-l md:border-black/10 md:pl-5 dark:md:border-white/10">
					<ThemeToggle />
					<Link
						to="/auth/signin"
						className="hidden px-2 text-[13.5px] text-black/60 transition-colors hover:text-black sm:block dark:text-white/55 dark:hover:text-white"
					>
						Log in
					</Link>
					<Link
						to="/auth/signin"
						className="rounded-full bg-[#121212] px-3.5 py-1.5 text-[13.5px] font-medium text-white transition-transform duration-150 ease-out active:scale-[0.97] dark:bg-white dark:text-[#121212]"
					>
						Sign up
					</Link>
				</div>
			</nav>
		</header>
	);
}
