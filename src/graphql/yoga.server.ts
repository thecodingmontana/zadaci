import { createSchema, createYoga } from "graphql-yoga";
import { auth } from "#/lib/auth";
import { activityResolvers, activityTypeDefs } from "./activity.server";
import { membersResolvers, membersTypeDefs } from "./members.server";
import { notesResolvers, notesTypeDefs } from "./notes.server";
import {
	projectDetailsResolvers,
	projectDetailsTypeDefs,
} from "./project-details.server";
import { projectsResolvers, projectsTypeDefs } from "./projects.server";
import { type GraphQLContext, resolvers, typeDefs } from "./schema.server";
import { settingsResolvers, settingsTypeDefs } from "./settings.server";
import { sharingResolvers, sharingTypeDefs } from "./sharing.server";
import { taskExtrasResolvers, taskExtrasTypeDefs } from "./task-extras.server";
import { tasksResolvers, tasksTypeDefs } from "./tasks.server";
import { teamsResolvers, teamsTypeDefs } from "./teams.server";

const schema = createSchema<GraphQLContext>({
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
	],
});

export const yoga = createYoga<object, GraphQLContext>({
	schema,
	graphqlEndpoint: "/api/graphql",
	graphiql: process.env.NODE_ENV !== "production",
	fetchAPI: { Response },
	context: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		return { user: session?.user ?? null };
	},
});
