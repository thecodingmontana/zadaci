// The repo's GitHub stars and forks for the landing page (src/routes/api/github-repo.ts).
// Unauthenticated GitHub allows 60 requests an hour per IP, so the route's answer is cached an hour.

export type RepoStats = { stars: number | null; forks: number | null };

/** "owner/repo" from a github.com URL, or null when it isn't one. */
export function repoPath(url: string): string | null {
	const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(
		url,
	);
	return m ? `${m[1]}/${m[2]}` : null;
}

const count = (n: unknown) =>
	typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;

/** Stars and forks; each null when GitHub errors, rate-limits, times out or answers oddly. */
export async function fetchRepoStats(
	repoUrl: string,
	fetchImpl: typeof fetch = fetch,
): Promise<RepoStats> {
	const none = { stars: null, forks: null };
	const path = repoPath(repoUrl);
	if (!path) return none;
	try {
		const res = await fetchImpl(`https://api.github.com/repos/${path}`, {
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "zadaci",
			},
			signal: AbortSignal.timeout(4000),
		});
		if (!res.ok) return none;
		const body = (await res.json()) as Record<string, unknown>;
		return {
			stars: count(body.stargazers_count),
			forks: count(body.forks_count),
		};
	} catch {
		return none;
	}
}
