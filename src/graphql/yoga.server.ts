import { createYoga } from "graphql-yoga";
import { auth } from "#/lib/auth";
import { type GraphQLContext, schema } from "./schema.server";

export const yoga = createYoga<object, GraphQLContext>({
	schema,
	graphqlEndpoint: "/api/graphql",
	graphiql: process.env.NODE_ENV !== "production",
	fetchAPI: { Response },
	context: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		// Same rule as the _authed route guard: no data until two-step verification is set up.
		return { user: session?.user.twoFactorEnabled ? session.user : null };
	},
});
