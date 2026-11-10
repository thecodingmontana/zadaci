import { type CSSProperties, useEffect, useState } from "react";
import { REPO_URL } from "#/components/shell/credits";
import type { RepoStats } from "#/lib/github-repo";
import { cn } from "#/lib/utils";

// The repo's stars and forks on every "Star on GitHub" button: fetched once per page load and
// shared by all of them.

let request: Promise<RepoStats> | null = null;
const loadStats = () =>
	(request ??= fetch("/api/github-repo")
		.then((r) => r.json() as Promise<RepoStats>)
		.catch(() => ({ stars: null, forks: null })));

const compact = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

function useRepoStats() {
	const [stats, setStats] = useState<RepoStats>({ stars: null, forks: null });
	useEffect(() => {
		let live = true;
		void loadStats().then((s) => live && setStats(s));
		return () => {
			live = false;
		};
	}, []);
	return stats;
}

/** ★ stars and ⑂ forks in a fixed-width slot, empty until known (never a made-up 0). */
function Stats() {
	const { stars, forks } = useRepoStats();
	const item = (n: number | null, icon: string, what: string) =>
		n === null ? null : (
			<span className="inline-flex items-center gap-1" title={`${n} ${what}`}>
				<span aria-hidden="true" className={cn(icon, "size-3.5")} />
				{compact.format(n)}
				<span className="sr-only"> {what}</span>
			</span>
		);
	return (
		<span className="inline-flex w-[11ch] items-center gap-2.5 text-(color:--q-text-3) tabular-nums">
			{item(stars, "icon-[solar--star-linear]", "stars")}
			{item(forks, "icon-[hugeicons--git-fork]", "forks")}
		</span>
	);
}

export function StarButton({
	className,
	style,
}: {
	className?: string;
	style?: CSSProperties;
}) {
	return (
		<a
			href={REPO_URL}
			target="_blank"
			rel="noopener noreferrer"
			className={cn("btn btn-secondary", className)}
			style={style}
		>
			<span
				aria-hidden="true"
				className="icon-[simple-icons--github] size-3.5"
			/>
			Star on GitHub
			<span aria-hidden="true" className="h-3.5 w-px bg-(--q-border)" />
			<Stats />
		</a>
	);
}
