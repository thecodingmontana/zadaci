import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit";
import { maxAliasesPlugin } from "@escape.tech/graphql-armor-max-aliases";
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth";
import { GraphQLError } from "graphql";
import { createSchema, createYoga, useErrorHandler } from "graphql-yoga";
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

/** A bug rather than an expected refusal: anything not thrown on purpose as a GraphQLError. */
export const isUnexpected = (error: GraphQLError) =>
	!!error.originalError && !(error.originalError instanceof GraphQLError);

export const yoga = createYoga<object, GraphQLContext>({
	schema,
	plugins: [
		maxAliasesPlugin({ n: LIMITS.aliases }),
		maxDepthPlugin({ n: LIMITS.depth }),
		costLimitPlugin({ maxCost: LIMITS.cost }),
		// unexpected errors reach Vercel's logs; "forbidden", "not found" and bad input don't
		// biome-ignore lint/correctness/useHookAtTopLevel: a Yoga plugin factory, not a React hook
		useErrorHandler(({ errors }) => {
			for (const error of errors)
				if (error instanceof GraphQLError && isUnexpected(error))
					console.error(
						`[graphql] ${error.path?.join(".") ?? "request"}:`,
						error.originalError?.stack ?? error.message,
					);
		}),
	],
	graphqlEndpoint: "/api/graphql",
	graphiql: process.env.NODE_ENV !== "production",
	fetchAPI: { Response },
	context: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		return { user: session?.user ?? null };
	},
});
