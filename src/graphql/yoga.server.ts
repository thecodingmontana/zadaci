import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit";
import { maxAliasesPlugin } from "@escape.tech/graphql-armor-max-aliases";
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth";
import { createSchema, createYoga } from "graphql-yoga";
import { auth } from "#/lib/auth";
import { activityResolvers, activityTypeDefs } from "./activity.server";
import { bookmarksResolvers, bookmarksTypeDefs } from "./bookmarks.server";
import { membersResolvers, membersTypeDefs } from "./members.server";
import { notesResolvers, notesTypeDefs } from "./notes.server";
import {
	projectDetailsResolvers,
	projectDetailsTypeDefs,
} from "./project-details.server";
import { projectsResolvers, projectsTypeDefs } from "./projects.server";
import { pushResolvers, pushTypeDefs } from "./push.server";
import { type GraphQLContext, resolvers, typeDefs } from "./schema.server";
import { settingsResolvers, settingsTypeDefs } from "./settings.server";
import { sharingResolvers, sharingTypeDefs } from "./sharing.server";
import { taskExtrasResolvers, taskExtrasTypeDefs } from "./task-extras.server";
import { tasksResolvers, tasksTypeDefs } from "./tasks.server";
import { teamsResolvers, teamsTypeDefs } from "./teams.server";
import { unsplashResolvers, unsplashTypeDefs } from "./unsplash.server";

/**
 * How much one request may ask for, so a single query can't flood the database (e.g. the
 * same list repeated under hundreds of aliases). Every operation the app sends fits;
 * tests/graphql-limits.test.ts checks that.
 */
export const LIMITS = { aliases: 15, depth: 12, cost: 5000 };

export const schema = createSchema<GraphQLContext>({
	typeDefs: [
		typeDefs,
		settingsTypeDefs,
		projectsTypeDefs,
		activityTypeDefs,
		membersTypeDefs,
		teamsTypeDefs,
		sharingTypeDefs,
		projectDetailsTypeDefs,
		tasksTypeDefs,
		taskExtrasTypeDefs,
		notesTypeDefs,
		unsplashTypeDefs,
		bookmarksTypeDefs,
		pushTypeDefs,
	],
	resolvers: [
		resolvers,
		settingsResolvers,
		projectsResolvers,
		activityResolvers,
		membersResolvers,
		teamsResolvers,
		sharingResolvers,
		projectDetailsResolvers,
		tasksResolvers,
		taskExtrasResolvers,
		notesResolvers,
		unsplashResolvers,
		bookmarksResolvers,
		pushResolvers,
	],
});

export const yoga = createYoga<object, GraphQLContext>({
	schema,
	plugins: [
		maxAliasesPlugin({ n: LIMITS.aliases }),
		maxDepthPlugin({ n: LIMITS.depth }),
		costLimitPlugin({ maxCost: LIMITS.cost }),
	],
	graphqlEndpoint: "/api/graphql",
	graphiql: process.env.NODE_ENV !== "production",
	fetchAPI: { Response },
	context: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		return { user: session?.user ?? null };
	},
});
