import { createElement } from "react";
import { SUPPORT_EMAIL } from "#/components/shell/credits";
import FeedbackEmail from "#/emails/feedback";
import { sendEmail } from "#/lib/email.server";
import { takeAllowance } from "#/lib/rate-limit.server";
import { badInput, type GraphQLContext, requireUser } from "./schema.server";

// Send feedback (sidebar and command menu): a bug report, an idea or anything else, emailed to the
// support inbox with the person as the reply-to. Nothing is stored.

export const feedbackTypeDefs = /* GraphQL */ `
	extend type Mutation {
		"kind: bug, idea or other. page: the path they were on. browser: a short description of it"
		sendFeedback(
			kind: String!
			message: String!
			slug: String
			page: String
			browser: String
		): Boolean!
	}
`;

const KINDS: Record<string, string> = {
	bug: "Bug report",
	idea: "Idea",
	other: "Feedback",
};
const PER_HOUR = 5;
const clip = (text: string | null | undefined, max: number) =>
	text ? text.trim().slice(0, max) || null : null;

export const feedbackResolvers = {
	Mutation: {
		sendFeedback: async (
			_: unknown,
			args: {
				kind: string;
				message: string;
				slug?: string | null;
				page?: string | null;
				browser?: string | null;
			},
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const kind = KINDS[args.kind];
			if (!kind) badInput("Pick bug, idea or other");
			const message = args.message.trim();
			if (!message) badInput("Write a few words first");
			if (message.length > 5000) badInput("Keep it under 5,000 characters");
			if (
				!(await takeAllowance(
					`feedback:${user.id}`,
					1,
					PER_HOUR,
					60 * 60 * 1000,
				))
			)
				badInput(
					`That's ${PER_HOUR} this hour, thank you! Send more in a while, or email ${SUPPORT_EMAIL}.`,
				);
			const page = clip(args.page, 300);
			const sent = await sendEmail(
				SUPPORT_EMAIL,
				`[${kind}] ${message.split("\n")[0].slice(0, 70)}`,
				createElement(FeedbackEmail, {
					kind,
					message,
					name: user.name,
					email: user.email,
					// only a path on this site: it's shown, never followed
					page: page?.startsWith("/") ? page : null,
					workspace: clip(args.slug, 64),
					browser: clip(args.browser, 120),
				}),
				undefined,
				user.email,
			);
			// no email key (a local setup): it was logged instead, which is fine
			if (!sent && process.env.RESEND_API_KEY)
				badInput(
					`Couldn't send it right now. Try again, or email ${SUPPORT_EMAIL}.`,
				);
			return true;
		},
	},
};
