import { and, eq, sql } from "drizzle-orm";
import { db, tables } from "#/db";
import { checkKey, keyHint, sealKey } from "#/lib/ai/keys.server";
import { dailyLimit, usedToday, userClock } from "#/lib/ai/limits.server";
import { modelFor, providerOf } from "#/lib/ai/providers";
import { takeAllowance } from "#/lib/rate-limit.server";
import {
	badInput,
	findWorkspaces,
	type GraphQLContext,
	requireUser,
} from "./schema.server";

// The assistant's settings for the signed-in person: their own AI keys (never sent back, only
// their last characters), which one is active, free messages left today, and clearing their chat.

const KEY_CHECKS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

export const aiTypeDefs = /* GraphQL */ `
	type AiKey {
		"openrouter, anthropic, openai or gemini"
		provider: String!
		"the key's last characters, e.g. …a1b2 (the key itself is never sent)"
		hint: String!
		model: String!
		"the key the assistant uses now"
		active: Boolean!
	}

	type AiStatus {
		keys: [AiKey!]!
		"free messages used today on the shared key"
		used: Int!
		"free messages a day without your own key"
		limit: Int!
	}

	extend type Query {
		aiStatus: AiStatus!
	}

	extend type Mutation {
		deleteAiConversation(slug: String!, id: ID!): Boolean!
		"checks the key with the provider, then saves it encrypted and makes it the active one"
		setAiKey(provider: String!, key: String!, model: String): AiStatus!
		"which saved key the assistant uses (null goes back to the shared free models)"
		useAiKey(provider: String): AiStatus!
		setAiModel(provider: String!, model: String!): AiStatus!
		removeAiKey(provider: String!): AiStatus!
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

async function status(userId: string) {
	const keys = await db
		.select({
			provider: tables.ai_user_key.provider,
			hint: tables.ai_user_key.hint,
			model: tables.ai_user_key.model,
			active: tables.ai_user_key.active,
		})
		.from(tables.ai_user_key)
		.where(eq(tables.ai_user_key.user_id, userId));
	const { today } = await userClock(userId);
	return {
		keys: keys.map((k) => {
			const provider = providerOf(k.provider);
			return { ...k, model: provider ? modelFor(provider, k.model) : k.model };
		}),
		used: await usedToday(userId, today),
		limit: dailyLimit(),
	};
}

const known = (id: string) => {
	const provider = providerOf(id);
	if (!provider) badInput("Unknown provider");
	return provider;
};

/** Makes one key (or none) the active one, in one statement. */
const activate = (userId: string, provider: string | null) =>
	db
		.update(tables.ai_user_key)
		.set({ active: sql`${tables.ai_user_key.provider} = ${provider ?? ""}` })
		.where(eq(tables.ai_user_key.user_id, userId));

export const aiResolvers = {
	Query: {
		aiStatus: (_: unknown, __: unknown, ctx: GraphQLContext) =>
			status(requireUser(ctx).id),
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
		setAiKey: async (
			_: unknown,
			args: { provider: string; key: string; model?: string | null },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const provider = known(args.provider);
			const key = args.key.trim();
			// each check calls the provider: a cap keeps us from being a free tester for leaked keys
			if (
				!(await takeAllowance(
					`ai-key-checks:${user.id}`,
					1,
					KEY_CHECKS_PER_HOUR,
					HOUR_MS,
				))
			)
				badInput("Too many key checks. Try again in an hour.");
			const check = await checkKey(provider.id, key);
			if (!check.ok) badInput(check.error);
			const row = {
				cipher: sealKey(key, user.id, provider.id),
				hint: keyHint(key),
				model: modelFor(provider, args.model?.trim().slice(0, 120)),
			};
			await db
				.insert(tables.ai_user_key)
				.values({ user_id: user.id, provider: provider.id, ...row })
				.onConflictDoUpdate({
					target: [tables.ai_user_key.user_id, tables.ai_user_key.provider],
					set: { ...row, updated_at: new Date() },
				});
			await activate(user.id, provider.id);
			return status(user.id);
		},
		useAiKey: async (
			_: unknown,
			args: { provider?: string | null },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			if (args.provider) known(args.provider);
			await activate(user.id, args.provider ?? null);
			return status(user.id);
		},
		setAiModel: async (
			_: unknown,
			args: { provider: string; model: string },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const provider = known(args.provider);
			await db
				.update(tables.ai_user_key)
				.set({
					model: modelFor(provider, args.model.trim().slice(0, 120)),
					updated_at: new Date(),
				})
				.where(
					and(
						eq(tables.ai_user_key.user_id, user.id),
						eq(tables.ai_user_key.provider, provider.id),
					),
				);
			return status(user.id);
		},
		removeAiKey: async (
			_: unknown,
			args: { provider: string },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			await db
				.delete(tables.ai_user_key)
				.where(
					and(
						eq(tables.ai_user_key.user_id, user.id),
						eq(tables.ai_user_key.provider, args.provider),
					),
				);
			return status(user.id);
		},
	},
};
