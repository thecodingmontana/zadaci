import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "#/components/theme-toggle";
import { ZadaciLogo } from "#/components/zadaci-logo";
import { MobileMenu } from "./mobile-menu";
import { StarButton } from "./star-button";

const LINKS = [
	{ href: "#plan", label: "Plan" },
	{ href: "#together", label: "Together" },
	{ href: "#ai", label: "AI" },
	{ href: "#github", label: "GitHub" },
];

export function LandingNav() {
	return (
		<header className="sticky top-0 z-40 border-b border-(color:--q-border) bg-(--q-bg)/85 backdrop-blur-md">
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
				<ul className="ml-auto hidden items-center gap-1 min-[769px]:flex">
					{LINKS.map((l) => (
						<li key={l.href}>
							<a href={l.href} className="btn btn-ghost">
								{l.label}
							</a>
						</li>
					))}
				</ul>
				<div className="ml-auto flex items-center gap-2 min-[769px]:ml-0 min-[769px]:border-l min-[769px]:border-(color:--q-border) min-[769px]:pl-4">
					<span className="hidden min-[769px]:contents">
						<ThemeToggle />
						<Link to="/auth/signin" className="btn btn-ghost">
							Log in
						</Link>
					</span>
					<StarButton className="hidden lg:inline-flex" />
					<Link to="/auth/signin" className="btn btn-primary">
						Sign up
					</Link>
					<MobileMenu links={LINKS} />
				</div>
			</nav>
		</header>
	);
}
