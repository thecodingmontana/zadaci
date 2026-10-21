import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { pushPublicKey, sendPushes } from "#/lib/push.server";
import { SITE_URL } from "#/lib/seo";
import { badInput, type GraphQLContext, requireUser } from "./schema.server";

// Settings → Push: turn push notifications on or off for this browser or phone.

export const pushTypeDefs = /* GraphQL */ `
	extend type Query {
		"the server's public push key, or null when push isn't set up"
		pushPublicKey: String
	}

	extend type Mutation {
		"remembers this device so notifications reach it"
		subscribePush(endpoint: String!, p256dh: String!, auth: String!): Boolean!
		unsubscribePush(endpoint: String!): Boolean!
		"sends a test notification to all of your devices; returns how many got it"
		testPush: Int!
	}
`;

const subscription = z.object({
	// push services only hand out https endpoints
	endpoint: z.url({ protocol: /^https$/ }).max(1000),
	p256dh: z.string().min(1).max(200),
	auth: z.string().min(1).max(100),
});

export const pushResolvers = {
	Query: {
		pushPublicKey: () => pushPublicKey(),
	},
	Mutation: {
		subscribePush: async (_: unknown, args: unknown, ctx: GraphQLContext) => {
			const user = requireUser(ctx);
			const parsed = subscription.safeParse(args);
			if (!parsed.success) badInput("That isn't a valid push subscription");
			const sub = parsed.data;
			// the same browser signing into another account moves over to it
			await db
				.insert(tables.push_subscription)
				.values({ user_id: user.id, ...sub })
				.onConflictDoUpdate({
					target: tables.push_subscription.endpoint,
					set: { user_id: user.id, p256dh: sub.p256dh, auth: sub.auth },
				});
			return true;
		},
		unsubscribePush: async (
			_: unknown,
			args: { endpoint: string },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			await db
				.delete(tables.push_subscription)
				.where(
					and(
						eq(tables.push_subscription.endpoint, args.endpoint),
						eq(tables.push_subscription.user_id, user.id),
					),
				);
			return true;
		},
		testPush: (_: unknown, __: unknown, ctx: GraphQLContext) =>
			sendPushes([
				{
					userId: requireUser(ctx).id,
					title: "Push notifications are on",
					body: "This is how Zadaci will reach you.",
					url: SITE_URL,
					tag: "test",
				},
			]),
	},
};
