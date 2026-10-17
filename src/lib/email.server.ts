import { render } from "@react-email/components";
import { createElement, type ReactElement } from "react";
import { Resend } from "resend";
import WorkspaceInvite from "#/emails/workspace-invite";
import { SITE_URL } from "#/lib/seo";

const FROM = "Team Zadaci <noreply@thegoodslab.tech>";

// No key (local setups, tests): emails are logged and skipped instead of sent.
const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

/** Sends one email; returns false instead of throwing so a mail outage never fails the action. */
export async function sendEmail(
	to: string,
	subject: string,
	react: ReactElement,
) {
	if (!resend) {
		console.info(
			`[email] RESEND_API_KEY not set, skipped "${subject}" to ${to}`,
		);
		return false;
	}
	try {
		const [html, text] = await Promise.all([
			render(react),
			render(react, { plainText: true }),
		]);
		const { error } = await resend.emails.send({
			from: FROM,
			to,
			subject,
			html,
			text,
		});
		if (error) throw new Error(error.message);
		return true;
	} catch (error) {
		console.error(
			`[email] "${subject}" to ${to} failed:`,
			(error as Error).message,
		);
		return false;
	}
}

export function sendInviteEmails(
	workspace: { name: string },
	sender: string,
	invites: { id: string; email: string; role: string }[],
) {
	// Each email links to its own invite, which only works for that address, never the
	// shared workspace code (anyone holding that joins as a member).
	const appUrl = (process.env.BETTER_AUTH_URL ?? SITE_URL).replace(/\/$/, "");
	return Promise.all(
		invites.map((invite) =>
			sendEmail(
				invite.email,
				`${sender} invited you to ${workspace.name} on Zadaci`,
				createElement(WorkspaceInvite, {
					sender,
					workspace: workspace.name,
					role: invite.role,
					link: `${appUrl}/join/${invite.id}`,
					baseUrl: SITE_URL,
				}),
			),
		),
	);
}
