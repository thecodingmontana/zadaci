import assert from "node:assert/strict";
import { test } from "node:test";
import { type Chunk, classify, rankModels, rotate } from "./rotation";

// fake model streams: each model id maps to the chunks it sends
const err = (code: string, message = "error") => ({
	type: "RUN_ERROR",
	code,
	message,
});
const text = (delta: string) => ({ type: "TEXT_MESSAGE_CONTENT", delta });
const done = { type: "RUN_FINISHED" };

async function play(
	script: Record<string, Chunk[]>,
	models = Object.keys(script),
) {
	const tried: string[] = [];
	const failures: [string, string][] = [];
	const out: Chunk[] = [];
	for await (const c of rotate(models, {
		start: async function* (model) {
			tried.push(model);
			yield { type: "RUN_STARTED" };
			for (const chunk of script[model] ?? []) yield chunk;
		},
		onFailure: (model, f) => {
			failures.push([model, f.kind]);
		},
	}))
		out.push(c);
	return {
		tried,
		failures,
		out,
		text: out
			.filter((c) => c.type === "TEXT_MESSAGE_CONTENT")
			.map((c) => c.delta)
			.join(""),
	};
}

test("a 429 on the first model moves on to the second", async () => {
	const r = await play({
		a: [err("429", "Provider returned error: rate limited")],
		b: [text("hi"), done],
	});
	assert.deepEqual(r.tried, ["a", "b"]);
	assert.equal(r.text, "hi");
	assert.deepEqual(r.failures, [["a", "rate_limit"]]);
});

test("a 5xx puts the model on cooldown (server failure) and moves on", async () => {
	const r = await play({ a: [err("502")], b: [text("ok"), done] });
	assert.deepEqual(r.failures, [["a", "server"]]);
	assert.equal(r.text, "ok");
});

test("a 401 never rotates", async () => {
	const r = await play({
		a: [err("401", "No auth credentials found")],
		b: [text("never"), done],
	});
	assert.deepEqual(r.tried, ["a"]);
	assert.equal(r.out.at(-1)?.code, "auth");
});

test("the account-wide daily limit stops rotation", async () => {
	const r = await play({
		a: [err("429", "Rate limit exceeded: free-models-per-day")],
		b: [text("x"), done],
	});
	assert.deepEqual(r.tried, ["a"]);
	assert.equal(r.out.at(-1)?.code, "account_limit");
});

test("429s on two different models in a row count as the account limit", async () => {
	const r = await play({
		a: [err("429")],
		b: [err("429")],
		c: [text("x"), done],
	});
	assert.deepEqual(r.tried, ["a", "b"]);
	assert.equal(
		r.out.at(-1)?.code,
		"rate_limit",
		"the person is told the models are busy, not out for the day",
	);
	assert.deepEqual(
		r.failures.at(-1),
		["b", "account_limit"],
		"the account pauses for everyone",
	);
});

test("a failure after text has streamed doesn't switch models mid-answer", async () => {
	const r = await play({
		a: [text("Half an ans"), err("502")],
		b: [text("other"), done],
	});
	assert.deepEqual(r.tried, ["a"]);
	assert.equal(r.text, "Half an ans");
	assert.equal(
		r.out.at(-1)?.type,
		"RUN_ERROR",
		"the error reaches the person, who can retry",
	);
});

test("an empty reply counts as a failure; three failures give up with a clear message", async () => {
	const r = await play({
		a: [done],
		b: [err("500")],
		c: [err("404")],
		d: [text("too late"), done],
	});
	assert.deepEqual(r.tried, ["a", "b", "c"]);
	assert.equal(r.out.at(-1)?.code, "all_failed");
});

test("ranking keeps free models with tool support and a big context, preferred first", () => {
	const ids = rankModels(
		[
			{
				id: "big/no-tools:free",
				context_length: 200000,
				supported_parameters: [],
			},
			{
				id: "small/tools:free",
				context_length: 8000,
				supported_parameters: ["tools"],
			},
			{
				id: "paid/tools",
				context_length: 100000,
				supported_parameters: ["tools"],
				pricing: { prompt: "0.001", completion: "0.002" },
			},
			{
				id: "openrouter/free",
				context_length: 200000,
				supported_parameters: ["tools"],
			},
			{
				id: "a/large:free",
				context_length: 262144,
				supported_parameters: ["tools"],
			},
			{
				id: "b/huge:free",
				context_length: 1000000,
				supported_parameters: ["tools", "tool_choice"],
			},
			{
				id: "c/gemma:free",
				context_length: 131072,
				supported_parameters: ["tools"],
			},
		],
		["gemma"],
	);
	assert.deepEqual(ids, ["c/gemma:free", "b/huge:free", "a/large:free"]);
});

test("errors are read from the code, the provider body or the message", () => {
	assert.equal(
		classify({ message: "Request failed with status 503" }).kind,
		"server",
	);
	assert.equal(
		classify({ rawEvent: { code: 429, message: "upstream rate-limited" } })
			.kind,
		"rate_limit",
	);
	assert.equal(
		classify({ code: "402", message: "Insufficient credits" }).kind,
		"billing",
	);
	assert.equal(
		classify({ code: "400", message: "tools not supported" }).kind,
		"bad_request",
	);
});
