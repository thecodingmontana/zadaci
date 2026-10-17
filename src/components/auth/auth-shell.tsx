import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ThemeToggle } from "#/components/theme-toggle";
import { ZadaciLogo } from "#/components/zadaci-logo";

export function AuthShell({
	title,
	description,
	children,
}: {
	title: string;
	description: ReactNode;
	children: ReactNode;
}) {
	return (
		<main className="relative grid min-h-dvh place-items-center px-4 py-10">
			<ThemeToggle className="absolute top-4 right-4" />
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex flex-col items-center gap-4 text-center">
					<Link to="/" className="flex items-center gap-2.5 rounded-md">
						<ZadaciLogo className="size-11" />
						<span className="text-4xl font-semibold tracking-tight">
							Zadaci
						</span>
					</Link>
					<div className="space-y-1">
						<h1 className="text-2xl font-bold text-balance">{title}</h1>
						<p className="text-sm text-pretty text-muted-foreground">
							{description}
						</p>
					</div>
				</div>
				{children}
			</div>
		</main>
	);
}
