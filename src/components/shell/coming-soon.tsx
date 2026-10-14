import { cn } from "#/lib/utils";

/** Placeholder for pages that exist in the nav but aren't built yet. */
export function ComingSoon({ title, icon }: { title: string; icon: string }) {
	return (
		<div className="grid flex-1 place-items-center p-6">
			<div className="flex max-w-sm flex-col items-center gap-3 text-center">
				<span className="grid size-12 place-items-center rounded-xl bg-brand/10 text-brand">
					<span className={cn(icon, "size-6")} aria-hidden="true" />
				</span>
				<h1 className="text-xl font-semibold text-balance">{title}</h1>
				<p className="text-sm text-pretty text-muted-foreground">
					This page is being built. Check back soon.
				</p>
			</div>
		</div>
	);
}
