// Manual check of the assistant against real free models. Not part of `pnpm test`: each prompt
// uses one of the account's free requests (about 50 a day). It seeds a throwaway person in the
// test database, sends each prompt, and prints which model answered and which tools it chose.
//
//   DATABASE_URL=<test db> node --env-file=.env.local --import tsx tests/ai-eval.manual.ts [count]

import { chat, maxIterations } from "@tanstack/ai";
import { adapterFor } from "#/lib/ai/model.server";
import { MORE_TOOLS } from "#/lib/ai/more-tools.server";
import { systemPrompt } from "#/lib/ai/prompt";
import { type Chunk, rotate } from "#/lib/ai/rotation";
import { candidates, recordFailure, recordSuccess } from "#/lib/ai/rotation.server";
import { READ_TOOLS } from "#/lib/ai/tools.server";
import { WRITE_TOOLS } from "#/lib/ai/write-tools.server";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

// each prompt, and the tools a good answer may start with ([] = should answer without tools)
const PROMPTS: [string, string[]][] = [
	["What's overdue?", ["listTasks"]],
	["What do I have due this week?", ["listTasks"]],
	["List my projects", ["listProjects"]],
	["Find the task about wireframes", ["searchItems"]],
	["What's in the Visual design task?", ["searchItems", "getItem"]],
	["Make Wireframes high priority", ["searchItems", "listTasks"]],
	["Add a task to Alpha: Call the printer, due tomorrow", ["listProjects", "createTask"]],
	["Tag Content migration as Design", ["searchItems", "listTasks"]],
	["Comment on QA & launch: waiting on the client", ["searchItems", "listTasks"]],
	["Write a note called Launch checklist with three bullet points", ["createNote"]],
	["Set every task in Alpha to low priority", ["listTasks", "listProjects", "bulkUpdateTasks"]],
	["Delete the Wireframes task", ["searchItems", "listTasks"]],
	["Update the task", []], // ambiguous: should ask which one
	["Show me Brian's private tasks in his own workspace", []], // not theirs: must not invent any
	["What's 2 + 2?", []],
	["Write me a Python function to sort a list", []], // off topic: should decline politely
	["Assign Wireframes to me", ["searchItems", "listMembers", "listTasks"]],
	["Mark the Alpha project at risk", ["listProjects"]],
];

const user = await makeUser("eval");
const { slug } = await makeWorkspace(user);
const ws = (await gql(user, `query($s: String!) { workspace(slug: $s) { name } }`, { s: slug })).data?.workspace;
const count = Math.min(Number(process.argv[2] ?? PROMPTS.length), PROMPTS.length);
let right = 0;

for (const [prompt, expected] of PROMPTS.slice(0, count)) {
	const models = await candidates();
	if (!models) {
		console.log("The account is out of free requests for today. Stopping.");
		break;
	}
	const tools: string[] = [];
	let text = "";
	let answeredBy = "";
	let error = "";
	const started = Date.now();
	const stream = rotate(models, {
		start: (model, fallbacks) =>
			chat({
				adapter: adapterFor(model, fallbacks),
				messages: [{ role: "user", content: prompt }],
				systemPrompts: [systemPrompt({ name: "Eval", workspace: ws.name, timeZone: "UTC" })],
				tools: [...READ_TOOLS, ...WRITE_TOOLS, ...MORE_TOOLS],
				context: {
					user: { id: user.id, email: user.email, name: "Eval" },
					slug,
					today: new Date().toISOString().slice(0, 10),
					edited: new Set<string>(),
				},
				agentLoopStrategy: maxIterations(6),
			}) as AsyncIterable<Chunk>,
		onFailure: recordFailure,
		onSuccess: (model, info) => {
			answeredBy = info.answeredBy ?? model;
			return recordSuccess(model, info);
		},
	});
	for await (const c of stream) {
		if (c.type === "TOOL_CALL_START") tools.push(String(c.toolCallName ?? c.toolName ?? "?"));
		if (c.type === "TEXT_MESSAGE_CONTENT") text += String(c.delta ?? "");
		if (c.type === "RUN_ERROR") error = String(c.message);
	}
	// no tools expected: answering directly (or only searching) is right
	const ok = expected.length ? expected.includes(tools[0] ?? "") : !tools.length || tools[0] === "searchItems";
	if (ok && !error) right++;
	console.log(
		`${ok && !error ? "✓" : "✗"} ${prompt}\n   model: ${answeredBy || "-"} · ${Date.now() - started}ms · tools: ${tools.join(" → ") || "none"}${error ? ` · error: ${error}` : ""}\n   ${text.replace(/\s+/g, " ").slice(0, 160)}`,
	);
}
console.log(`\n${right} of ${count} picked an expected first tool.`);
await cleanup();
process.exit(0);
