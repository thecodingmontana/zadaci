import { type CSSProperties, useEffect, useRef, useState } from "react";
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

/** Counts up to `to` once, the first time `on` is true (600ms, the page's ease); shown at once with reduced motion. */
function useCountUp(to: number | null, on: boolean) {
	const [n, setN] = useState<number | null>(null);
	useEffect(() => {
		if (to === null || !on) return;
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
		let raf = 0;
		const start = performance.now();
		const step = (t: number) => {
			const p = Math.min(1, (t - start) / 600);
			setN(Math.round(to * (1 - (1 - p) ** 3)));
			if (p < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [to, on]);
	return n;
}

/** ★ stars and ⑂ forks in a fixed-width slot, empty until known (never a made-up 0). */
function Stats() {
	const { stars, forks } = useRepoStats();
	const ref = useRef<HTMLSpanElement>(null);
	const [seen, setSeen] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const io = new IntersectionObserver(([e]) => {
			if (e?.isIntersecting) {
				setSeen(true);
				io.disconnect();
			}
		});
		io.observe(el);
		return () => io.disconnect();
	}, []);
	const shownStars = useCountUp(stars, seen);
	const shownForks = useCountUp(forks, seen);
	const item = (
		n: number | null,
		total: number | null,
		icon: string,
		what: string,
	) =>
		n === null || total === null ? null : (
			<span
				className="inline-flex items-center gap-1"
				title={`${total} ${what}`}
			>
				<span aria-hidden="true" className={cn(icon, "size-3.5")} />
				{compact.format(n)}
				<span className="sr-only"> {what}</span>
			</span>
		);
	return (
		<span
			ref={ref}
			className="inline-flex w-[11ch] items-center gap-2.5 text-(color:--q-text-3) tabular-nums"
		>
			{item(shownStars, stars, "icon-[solar--star-linear]", "stars")}
			{item(shownForks, forks, "icon-[hugeicons--git-fork]", "forks")}
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
