import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
		<main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
			<div
				aria-hidden="true"
				className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[48px_48px] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
			/>
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
