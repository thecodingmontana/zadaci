import { sql } from "drizzle-orm";
import { db, tables } from "#/db";
import { aiKey, FREE_ROUTER, pinnedModel } from "./model.server";
import {
	COOLDOWN_MS,
	classify,
	type Failure,
	type ModelInfo,
	rankModels,
} from "./rotation";

// Which free models the assistant tries, and in what order. The ranking and every cooldown live
// in Postgres (app_ai_model), because each serverless instance starts with empty memory.

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const RANK_TTL_MS = 6 * 3_600_000;
// the account-wide free limit is kept as a row of its own
export const ACCOUNT_ROW = "*account*";
const MAX_PROBES = 5;
const PROBE_PASSES = 2;

const preferred = () =>
	(process.env.AI_MODEL_PREFERRED ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

const nextUtcMidnight = (now = new Date()) =>
	new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
	);

async function discover() {
	const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`models list answered ${res.status}`);
	const { data } = (await res.json()) as { data: ModelInfo[] };
	const all = new Map(data.map((m) => [m.id, m]));
	let ranked = rankModels(data, preferred());
	if (process.env.AI_ROTATION_PROBE === "true") ranked = await probe(ranked);
	const now = new Date();
	await db.transaction(async (tx) => {
		await tx
			.update(tables.ai_model)
			.set({ rank: null })
			.where(sql`${tables.ai_model.id} <> ${ACCOUNT_ROW}`);
		for (const [rank, id] of ranked.entries()) {
			const row = {
				rank,
				context: all.get(id)?.context_length ?? null,
				ranked_at: now,
			};
			await tx
				.insert(tables.ai_model)
				.values({ id, ...row })
				.onConflictDoUpdate({ target: tables.ai_model.id, set: row });
		}
	});
	return ranked;
}

/** Sends a one-word request to the top models; keeps those that answer (until enough pass). */
async function probe(ranked: string[]) {
	const passed: string[] = [];
	let probes = 0;
	for (const id of ranked) {
		if (passed.length >= PROBE_PASSES || probes >= MAX_PROBES) break;
		probes++;
		try {
			const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					authorization: `Bearer ${aiKey()}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: id,
					max_tokens: 5,
					messages: [{ role: "user", content: "Say OK" }],
				}),
				signal: AbortSignal.timeout(15000),
			});
			if (res.ok) passed.push(id);
			else
				await recordFailure(
					id,
					classify({ code: String(res.status), message: await res.text() }),
				);
		} catch (error) {
			await recordFailure(id, { kind: "server", message: String(error) });
		}
	}
	// the probed winners first, then the untested rest in their usual order
	return [...passed, ...ranked.filter((id) => !passed.includes(id))];
}

/**
 * The models to try for one message, best first, without those cooling down. Null when the
 * whole account is out of free requests.
 */
export async function candidates(): Promise<string[] | null> {
	const pinned = pinnedModel();
	if (pinned) return [pinned];
	const rows = await db.select().from(tables.ai_model);
	const now = Date.now();
	const cooling = new Set(
		rows
			.filter((r) => r.cooldown_until && r.cooldown_until.getTime() > now)
			.map((r) => r.id),
	);
	if (cooling.has(ACCOUNT_ROW)) return null;
	const ranked = rows
		.filter((r) => r.rank !== null && r.id !== ACCOUNT_ROW)
		.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
	const fresh =
		ranked.length > 0 &&
		ranked.some(
			(r) => r.ranked_at && now - r.ranked_at.getTime() < RANK_TTL_MS,
		);
	let ids = ranked.map((r) => r.id);
	if (!fresh) {
		try {
			ids = await discover();
		} catch (error) {
			console.error("[ai] model discovery failed:", String(error));
			// keep the last ranking; with none, the preferred ids (if set)
			if (!ids.length) ids = preferred().filter((p) => p.includes("/"));
		}
	}
	// OpenRouter's own free router is always the last resort, even while it's cooling down
	const ready = ids.filter((id) => id !== FREE_ROUTER && !cooling.has(id));
	return [...ready, FREE_ROUTER];
}

export async function recordFailure(model: string, failure: Failure) {
	if (failure.kind === "auth" || failure.kind === "billing") {
		// a key or credit problem: never retried; the message stays in the logs only
		console.error(
			`[ai] ${failure.kind} error from OpenRouter (${model}):`,
			failure.message,
		);
		return;
	}
	const account = failure.kind === "account_limit";
	const id = account ? ACCOUNT_ROW : model;
	const until = account
		? nextUtcMidnight()
		: new Date(
				Date.now() + (COOLDOWN_MS[failure.kind] ?? COOLDOWN_MS.server ?? 0),
			);
	console.warn(
		`[ai] ${model} failed (${failure.kind}); skipped until ${until.toISOString()}`,
	);
	const set = {
		cooldown_until: until,
		last_error: `${failure.kind}: ${failure.message}`.slice(0, 500),
		updated_at: new Date(),
	};
	await db
		.insert(tables.ai_model)
		.values({ id, ...set, failures: 1 })
		.onConflictDoUpdate({
			target: tables.ai_model.id,
			set: { ...set, failures: sql`${tables.ai_model.failures} + 1` },
		});
}

export async function recordSuccess(
	model: string,
	info: { ms: number; fallback: boolean; answeredBy?: string },
) {
	console.info(
		`[ai] answered by ${info.answeredBy ?? model} in ${info.ms}ms${info.fallback ? " (fallback)" : ""}`,
	);
	await db
		.insert(tables.ai_model)
		.values({ id: model, successes: 1, last_ms: info.ms })
		.onConflictDoUpdate({
			target: tables.ai_model.id,
			set: {
				successes: sql`${tables.ai_model.successes} + 1`,
				last_ms: info.ms,
				updated_at: new Date(),
			},
		});
}

/** For the internal status endpoint: models with failures or a cooldown, newest first. */
export async function modelStatus() {
	const rows = await db
		.select()
		.from(tables.ai_model)
		.where(
			sql`${tables.ai_model.rank} is not null or ${tables.ai_model.failures} > 0 or ${tables.ai_model.id} = ${ACCOUNT_ROW}`,
		)
		.orderBy(sql`${tables.ai_model.rank} asc nulls last`);
	const now = new Date();
	return rows.map((r) => ({
		...r,
		coolingDown: !!r.cooldown_until && r.cooldown_until > now,
	}));
}
