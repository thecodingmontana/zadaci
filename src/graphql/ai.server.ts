import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import {
	badInput,
	findWorkspaces,
	type GraphQLContext,
	requireUser,
} from "./schema.server";

// Clearing the assistant's chat: only the signed-in person's own conversation in a workspace.

export const aiTypeDefs = /* GraphQL */ `
	extend type Mutation {
		deleteAiConversation(slug: String!, id: ID!): Boolean!
	}
`;

async function mine(ctx: GraphQLContext, slug: string) {
	const user = requireUser(ctx);
	const [workspace] = await findWorkspaces(user.id, slug);
	if (!workspace) badInput("Workspace not found");
	return and(
		eq(tables.ai_conversation.user_id, user.id),
		eq(tables.ai_conversation.workspace_id, workspace.id),
	);
}

export const aiResolvers = {
	Mutation: {
		deleteAiConversation: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			await db
				.delete(tables.ai_conversation)
				.where(
					and(
						await mine(ctx, args.slug),
						eq(tables.ai_conversation.id, args.id),
					),
				);
			return true;
		},
	},
};
