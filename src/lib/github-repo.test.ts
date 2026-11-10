import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRepoStats, repoPath } from "./github-repo";

const REPO = "https://github.com/thecodingmontana/zadaci";
const answer = (status: number, body: unknown) =>
	(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const NONE = { stars: null, forks: null };

test("reads owner/repo from the repo URL", () => {
	assert.equal(repoPath(REPO), "thecodingmontana/zadaci");
	assert.equal(repoPath(`${REPO}.git`), "thecodingmontana/zadaci");
	assert.equal(repoPath("https://example.com/a/b"), null);
});

test("returns stars and forks from the right repo", async () => {
	let asked = "";
	const f = (async (url: string) => {
		asked = url;
		return new Response(
			JSON.stringify({ stargazers_count: 1234, forks_count: 86 }),
		);
	}) as typeof fetch;
	assert.deepEqual(await fetchRepoStats(REPO, f), { stars: 1234, forks: 86 });
	assert.equal(asked, "https://api.github.com/repos/thecodingmontana/zadaci");
});

test("falls back to nulls on errors, rate limits and odd answers", async () => {
	assert.deepEqual(
		await fetchRepoStats(
			REPO,
			answer(403, { message: "API rate limit exceeded" }),
		),
		NONE,
	);
	assert.deepEqual(
		await fetchRepoStats(REPO, answer(200, { stargazers_count: "12" })),
		NONE,
	);
	const boom = (async () => {
		throw new Error("timeout");
	}) as typeof fetch;
	assert.deepEqual(await fetchRepoStats(REPO, boom), NONE);
});
