import { execute, parse } from "graphql";
import { schema } from "#/graphql/yoga.server";
import { announceChange, mutationSlugs } from "#/lib/realtime.server";
import { asAssistant } from "./assistant-scope.server";

// The assistant's tools read and write through the app's own GraphQL schema, as the signed-in
// person, so every existing permission check applies exactly as it does in the app.

export type AiUser = { id: string; email: string; name: string };

export type AiContext = {
	user: AiUser;
	slug: string;
	/** today in the person's time zone, YYYY-MM-DD */
	today: string;
	/** tasks changed without approval during this one message (at most 3 allowed) */
	edited: Set<string>;
};

/** Runs one operation; returns its data, or a short error message the model can act on. */
export async function run<T = Record<string, unknown>>(
	ctx: AiContext,
	query: string,
	variables: Record<string, unknown> = {},
): Promise<{ data: T } | { error: string }> {
	const document = parse(query);
	const variableValues = { slug: ctx.slug, ...variables };
	// anything this changes is logged as done "via assistant"
	const result = await asAssistant(async () =>
		execute({
			schema,
			document,
			variableValues,
			contextValue: { user: ctx.user },
		}),
	);
	if (result.errors?.length)
		return { error: result.errors.map((e) => e.message).join("; ") };
	// Zad's changes reach everyone who has the workspace open, like changes made in the app
	for (const slug of mutationSlugs(document, variableValues))
		announceChange(slug);
	return { data: result.data as T };
}
