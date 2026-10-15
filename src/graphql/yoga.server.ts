import { createSchema, createYoga } from "graphql-yoga";
import { auth, secondFactors } from "#/lib/auth";
import { activityResolvers, activityTypeDefs } from "./activity.server";
import { membersResolvers, membersTypeDefs } from "./members.server";
import { projectsResolvers, projectsTypeDefs } from "./projects.server";
import { type GraphQLContext, resolvers, typeDefs } from "./schema.server";
import { settingsResolvers, settingsTypeDefs } from "./settings.server";

const schema = createSchema<GraphQLContext>({
	typeDefs: [
		typeDefs,
		settingsTypeDefs,
		projectsTypeDefs,
		activityTypeDefs,
		membersTypeDefs,
	],
	resolvers: [
		resolvers,
		settingsResolvers,
		projectsResolvers,
		activityResolvers,
		membersResolvers,
	],
});

export const yoga = createYoga<object, GraphQLContext>({
	schema,
	graphqlEndpoint: "/api/graphql",
	graphiql: process.env.NODE_ENV !== "production",
	fetchAPI: { Response },
	context: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { user: null };
		// Same rule as the _authed route guard: no data until a second step is set up.
		return {
			user: (await secondFactors(session.user)).length ? session.user : null,
		};
	},
});
