import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import {
	badInput,
	findWorkspaces,
	type GraphQLContext,
	requireUser,
} from "./schema.server";

// The assistant's saved chats: the signed-in person's own conversations in a workspace.

export const aiTypeDefs = /* GraphQL */ `
	type AiConversation {
		id: ID!
		title: String!
		updatedAt: String!
	}

	extend type Query {
		"your saved assistant chats in this workspace, newest first"
		aiConversations(slug: String!): [AiConversation!]!
	}

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
	Query: {
		aiConversations: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			const rows = await db
				.select()
				.from(tables.ai_conversation)
				.where(await mine(ctx, args.slug))
				.orderBy(desc(tables.ai_conversation.updated_at))
				.limit(50);
			return rows.map((r) => ({
				id: r.id,
				title: r.title,
				updatedAt: r.updated_at.toISOString(),
			}));
		},
	},
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
