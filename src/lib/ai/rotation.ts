// Choosing and rotating between free models. Pure logic (no database, no network) so it can be
// tested with fake responses; rotation.server.ts wires it to Postgres and OpenRouter.

export type ModelInfo = {
	id: string;
	context_length?: number | null;
	created?: number | null;
	supported_parameters?: string[] | null;
	pricing?: {
		prompt?: string | number | null;
		completion?: string | number | null;
	} | null;
};

const MIN_CONTEXT = 32_000;
const isZero = (v: unknown) => v != null && Number(v) === 0;

/** Free models that can call tools, best first (preferred list, then context, then newest, then extras). */
export function rankModels(models: ModelInfo[], preferred: string[] = []) {
	const rankOf = (id: string) => {
		const i = preferred.findIndex((p) => p && id.includes(p));
		return i < 0 ? preferred.length : i;
	};
	const extras = (m: ModelInfo) =>
		["tool_choice", "structured_outputs"].filter((p) =>
			m.supported_parameters?.includes(p),
		).length;
	return models
		.filter(
			(m) =>
				!m.id.startsWith("openrouter/") &&
				(m.id.endsWith(":free") ||
					(isZero(m.pricing?.prompt) && isZero(m.pricing?.completion))) &&
				!!m.supported_parameters?.includes("tools") &&
				(m.context_length ?? 0) >= MIN_CONTEXT,
		)
		.sort(
			(a, b) =>
				rankOf(a.id) - rankOf(b.id) ||
				(b.context_length ?? 0) - (a.context_length ?? 0) ||
				(b.created ?? 0) - (a.created ?? 0) ||
				extras(b) - extras(a),
		)
		.map((m) => m.id);
}

export type FailureKind =
	| "rate_limit" // one model or provider is busy: try another
	| "account_limit" // the whole account is out of free requests: stop
	| "server" // 5xx, timeout, empty reply or broken tool call: try another
	| "bad_request" // 400/404: the model can't take this request or is gone: try another
	| "auth" // 401/403: key or account problem: stop, never retry
	| "billing"; // 402: credits: stop

export type Failure = { kind: FailureKind; message: string };

/** How long a failing model is skipped. */
export const COOLDOWN_MS: Partial<Record<FailureKind, number>> = {
	rate_limit: 5 * 60_000,
	server: 30 * 60_000,
	bad_request: 60 * 60_000,
};

/** Kinds where trying another model can't help. */
export const STOPS: FailureKind[] = ["account_limit", "auth", "billing"];

/** OpenRouter's words for the account's daily cap on free models ("free-models-per-day"). */
export const DAILY_LIMIT = /free-models-per-day|per[- ]day|daily limit/i;

type ErrorLike = {
	code?: unknown;
	message?: unknown;
	rawEvent?: unknown;
	[key: string]: unknown;
};

/** Reads what went wrong from a stream error: its code, the provider's raw body, or the message. */
export function classify(error: ErrorLike): Failure {
	const raw = JSON.stringify(error.rawEvent ?? "");
	const text = `${error.code ?? ""} ${error.message ?? ""} ${raw}`;
	const message = String(error.message ?? "The model failed");
	const status = Number(
		/^\d{3}$/.test(String(error.code ?? ""))
			? String(error.code)
			: (/\b(40[0-9]|429|5\d\d)\b/.exec(text)?.[1] ?? 0),
	);
	// OpenRouter's daily cap on free models is account wide ("free-models-per-day")
	if (DAILY_LIMIT.test(text)) return { kind: "account_limit", message };
	// a 403 about one model ("only available on agentic harnesses") isn't a key problem
	if (
		status === 401 ||
		(status === 403 && /key|credential|account|banned|forbidden/i.test(message))
	)
		return { kind: "auth", message };
	if (status === 403) return { kind: "bad_request", message };
	if (status === 402 || /insufficient credits|payment required/i.test(text))
		return { kind: "billing", message };
	if (status === 429 || /rate[- ]?limit/i.test(text))
		return { kind: "rate_limit", message };
	if (status === 400 || status === 404) return { kind: "bad_request", message };
	return { kind: "server", message };
}

export type Chunk = { type: string; [key: string]: unknown };

// chunks that mean the model has started answering (text, or a tool call)
const VISIBLE = new Set([
	"TEXT_MESSAGE_CONTENT",
	"TEXT_MESSAGE_CHUNK",
	"TOOL_CALL_START",
	"TOOL_CALL_CHUNK",
	"TOOL_CALL_RESULT",
]);
const isVisible = (c: Chunk) =>
	VISIBLE.has(c.type) &&
	!(c.type === "TEXT_MESSAGE_CONTENT" && !String(c.delta ?? "").trim());

export type RotateHooks = {
	/** starts the answer with one model (the next ones are its OpenRouter fallbacks) */
	start: (model: string, fallbacks: string[]) => AsyncIterable<Chunk>;
	onFailure?: (model: string, failure: Failure) => void | Promise<void>;
	onSuccess?: (
		model: string,
		info: { ms: number; fallback: boolean; answeredBy?: string },
	) => void | Promise<void>;
};

/** An error chunk: the stream ends and the person sees the message, with a retry button. */
export const runError = (message: string, code: string): Chunk => ({
	type: "RUN_ERROR",
	message,
	code,
	error: { message, code },
	timestamp: Date.now(),
});

/** The error the person sees when every model failed, or the free limit is reached. */
export const giveUp = (kind: FailureKind | "all_failed"): Chunk =>
	runError(
		kind === "account_limit"
			? "Zad has reached today's limit. It resets within a day; try again tomorrow."
			: kind === "auth" || kind === "billing"
				? "Zad is unavailable right now. Please try again later."
				: "Zad is busy right now. Please try again in a few minutes.",
		kind,
	);

/**
 * Streams an answer, moving to the next model when one fails before any text or tool call has
 * streamed. Once the answer has started it never switches mid-way: an error then reaches the
 * person (who can retry, and the retry starts with the next model).
 */
export async function* rotate(
	models: string[],
	hooks: RotateHooks,
	maxModels = 3,
): AsyncIterable<Chunk> {
	const tries = models.slice(0, maxModels);
	let lastRateLimited: string | null = null;
	for (const [i, model] of tries.entries()) {
		const started = Date.now();
		const buffer: Chunk[] = [];
		let visible = false;
		let failure: Failure | null = null;
		let answeredBy: string | undefined;
		for await (const chunk of hooks.start(model, tries.slice(i + 1))) {
			if (visible) {
				if (chunk.type === "RUN_ERROR")
					await hooks.onFailure?.(model, classify(chunk));
				else if (chunk.type === "RUN_FINISHED")
					answeredBy =
						(chunk.metadata as { tanstack?: { model?: string } } | undefined)
							?.tanstack?.model ?? answeredBy;
				yield chunk;
				continue;
			}
			if (chunk.type === "RUN_ERROR") {
				failure = classify(chunk);
				break;
			}
			if (chunk.type === "RUN_FINISHED") {
				failure = { kind: "server", message: "The model sent an empty reply" };
				break;
			}
			if (isVisible(chunk)) {
				visible = true;
				yield* buffer;
				yield chunk;
			} else buffer.push(chunk);
		}
		if (visible) {
			await hooks.onSuccess?.(model, {
				ms: Date.now() - started,
				fallback: i > 0,
				answeredBy,
			});
			return;
		}
		if (!failure)
			failure = {
				kind: "server",
				message: "The stream ended without an answer",
			};
		await hooks.onFailure?.(model, failure);
		if (STOPS.includes(failure.kind)) {
			yield giveUp(failure.kind);
			return;
		}
		// two different models rate limited in a row: treat it as the account-wide limit
		if (failure.kind === "rate_limit") {
			if (lastRateLimited && lastRateLimited !== model) {
				await hooks.onFailure?.(model, {
					kind: "account_limit",
					message: "Rate limited on two models in a row",
				});
				yield giveUp("rate_limit");
				return;
			}
			lastRateLimited = model;
		} else lastRateLimited = null;
	}
	yield giveUp("all_failed");
}
