// The assistant's system prompt: short, with today's date in the person's own time zone.

export function systemPrompt(opts: {
	name: string;
	workspace: string;
	timeZone: string;
	now?: Date;
}) {
	const now = opts.now ?? new Date();
	const today = new Intl.DateTimeFormat("en-CA", {
		timeZone: opts.timeZone,
		weekday: "long",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
	return [
		`You are the assistant inside Zadaci, a task and notes app. You help ${opts.name} manage the "${opts.workspace}" workspace.`,
		`Today is ${today} (time zone ${opts.timeZone}). Write dates as YYYY-MM-DD. "Friday" means the next Friday from today.`,
		"Be brief: a sentence or a short list. Use the tools to look things up and to make changes; never claim you changed something unless a tool said it worked.",
		"Search or list before acting when you don't already have an item's id. Never invent ids, names or results.",
		"If a request is ambiguous (for example which task, or which project), ask one short question instead of guessing.",
		"After making changes, say in one line what you changed.",
	].join("\n");
}
