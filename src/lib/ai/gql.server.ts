import { execute, parse } from "graphql";
import { schema } from "#/graphql/yoga.server";

// The assistant's tools read and write through the app's own GraphQL schema, as the signed-in
// person, so every existing permission check applies exactly as it does in the app.

export type AiUser = { id: string; email: string; name: string };

export type AiContext = {
	user: AiUser;
	slug: string;
	/** today in the person's time zone, YYYY-MM-DD */
	today: string;
};

/** Runs one operation; returns its data, or a short error message the model can act on. */
export async function run<T = Record<string, unknown>>(
	ctx: AiContext,
	query: string,
	variables: Record<string, unknown> = {},
): Promise<{ data: T } | { error: string }> {
	const result = await execute({
		schema,
		document: parse(query),
		variableValues: { slug: ctx.slug, ...variables },
		contextValue: { user: ctx.user },
	});
	if (result.errors?.length)
		return { error: result.errors.map((e) => e.message).join("; ") };
	return { data: result.data as T };
}
