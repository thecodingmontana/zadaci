import { AsyncLocalStorage } from "node:async_hooks";
import { render } from "@react-email/components";
import { waitUntil } from "@vercel/functions";
import { inArray } from "drizzle-orm";
import { createElement, type ReactElement } from "react";
import { Resend } from "resend";
import { SUPPORT_EMAIL } from "#/components/shell/credits";
import { db, tables } from "#/db";
import NotificationEmail from "#/emails/notification";
import WorkspaceInvite from "#/emails/workspace-invite";
import { PREF_DEFAULTS } from "#/lib/preferences";
import { type PushMessage, sendPushes } from "#/lib/push.server";
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
	/** for notification and digest emails: where to turn them off (mail apps show an Unsubscribe link) */
	unsubscribeUrl?: string,
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
			// replies reach a person, and mail apps can offer Unsubscribe; both help keep us out of spam
			replyTo: SUPPORT_EMAIL,
			...(unsubscribeUrl && {
				headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
			}),
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

// ---- notification emails and pushes (mentions, assignments, comments) ----

/** The setting each notification type answers to, per channel; other types send nothing. */
const CHANNEL_KEY = {
	email: {
		mention: "email_mention",
		assign: "email_assign",
		comment: "email_comment",
	},
	push: {
		mention: "push_mention",
		assign: "push_assign",
		comment: "push_comment",
	},
} as const satisfies Record<
	string,
	Record<string, keyof typeof PREF_DEFAULTS.notif>
>;

/** Which setting decides this email or push, or null when it shouldn't be sent at all. */
export function notifKey(
	channel: keyof typeof CHANNEL_KEY,
	row: { type: string; user_id: string; actor_id?: string | null },
	prefs: unknown,
) {
	const key = (
		CHANNEL_KEY[channel] as Record<string, keyof typeof PREF_DEFAULTS.notif>
	)[row.type];
	if (!key || row.actor_id === row.user_id) return null;
	const chosen = (prefs as { notif?: Record<string, boolean> } | null)?.notif?.[
		key
	];
	return (chosen ?? PREF_DEFAULTS.notif[key]) ? key : null;
}

// Emails and pushes wait, not yet started, until the request's work is done, then go out
// together: each request its own queue, and only for notifications that were really saved.
type Send = { notificationIds: string[]; start: () => Promise<unknown> };
const requestQueue = new AsyncLocalStorage<Send[]>();

/** Runs `work` with its own queue, then sends what it queued. */
export async function withEmails<T>(work: () => Promise<T>): Promise<T> {
	const queue: Send[] = [];
	const result = await requestQueue.run(queue, work);
	await send(queue);
	return result;
}

/** Capped so sends can't hang the request. */
async function send(queue: Send[], limitMs = 3000) {
	if (!queue.length) return;
	// a change that rolled back took its notifications with it: nothing goes out for those
	const ids = queue.flatMap((s) => s.notificationIds);
	const saved = new Set(
		ids.length
			? (
					await db
						.select({ id: tables.notification.id })
						.from(tables.notification)
						.where(inArray(tables.notification.id, ids))
				).map((r) => r.id)
			: [],
	);
	const all = Promise.allSettled(
		queue
			.filter((s) => s.notificationIds.every((id) => saved.has(id)))
			.map((s) => s.start()),
	);
	// on Vercel, sends still going after the cap finish after the response instead of being dropped
	waitUntil(all);
	await Promise.race([all, new Promise((r) => setTimeout(r, limitMs))]);
}

type NotificationRow = {
	id: string;
	user_id: string;
	workspace_id: string;
	actor_id?: string | null;
	type: string;
	text: string;
	snippet?: string | null;
	project_id?: string | null;
	task_id?: string | null;
	chat_channel_id?: string | null;
	chat_message_id?: string | null;
};

/** Queues an email and a push for each notification, as far as its recipient asked for them. */
export async function queueNotifications(rows: NotificationRow[]) {
	const wanted = rows.filter(
		(r) => r.type in CHANNEL_KEY.email && r.actor_id !== r.user_id,
	);
	if (!wanted.length) return;
	const ids = (list: (string | null | undefined)[]) => [
		...new Set(list.filter((x): x is string => !!x)),
	];
	const [people, workspaces, tasks] = await Promise.all([
		db
			.select({
				id: tables.user.id,
				name: tables.user.name,
				email: tables.user.email,
				prefs: tables.user.preferences,
			})
			.from(tables.user)
			.where(
				inArray(
					tables.user.id,
					ids(wanted.flatMap((r) => [r.user_id, r.actor_id])),
				),
			),
		db
			.select({
				id: tables.workspace.id,
				slug: tables.workspace.slug,
				name: tables.workspace.name,
			})
			.from(tables.workspace)
			.where(
				inArray(tables.workspace.id, ids(wanted.map((r) => r.workspace_id))),
			),
		ids(wanted.map((r) => r.task_id)).length
			? db
					.select({ id: tables.task.id, name: tables.task.name })
					.from(tables.task)
					.where(inArray(tables.task.id, ids(wanted.map((r) => r.task_id))))
			: Promise.resolve([]),
	]);
	const person = new Map(people.map((p) => [p.id, p]));
	const space = new Map(workspaces.map((w) => [w.id, w]));
	const taskName = new Map(tasks.map((t) => [t.id, t.name]));
	const appUrl = (process.env.BETTER_AUTH_URL ?? SITE_URL).replace(/\/$/, "");
	const queue = requestQueue.getStore();
	const pending = queue ?? [];
	const pushes: PushMessage[] = [];
	const pushed: string[] = [];
	for (const row of wanted) {
		const to = person.get(row.user_id);
		const ws = space.get(row.workspace_id);
		if (!to || !ws) continue;
		const actor = row.actor_id ? person.get(row.actor_id)?.name : null;
		const about = row.task_id ? taskName.get(row.task_id) : null;
		const headline = `${actor ?? "Someone"} ${row.text}${about ? ` “${about}”` : ""}`;
		const link =
			row.task_id && row.project_id
				? `${appUrl}/w/${ws.slug}/p/${row.project_id}?task=${row.task_id}`
				: row.chat_channel_id
					? `${appUrl}/w/${ws.slug}/chat?c=${row.chat_channel_id}${row.chat_message_id ? `&m=${row.chat_message_id}` : ""}`
					: `${appUrl}/w/${ws.slug}/notifications`;
		if (notifKey("push", row, to.prefs) && pushed.push(row.id))
			pushes.push({
				userId: to.id,
				title: headline,
				body: row.snippet ?? ws.name,
				url: link,
				tag: row.task_id ?? undefined,
			});
		if (notifKey("email", row, to.prefs))
			pending.push({
				notificationIds: [row.id],
				start: () =>
					sendEmail(
						to.email,
						headline,
						createElement(NotificationEmail, {
							headline,
							snippet: row.snippet,
							workspace: ws.name,
							link,
							settingsLink: `${appUrl}/w/${ws.slug}/settings?sec=notif-email`,
							baseUrl: SITE_URL,
						}),
						`${appUrl}/w/${ws.slug}/settings?sec=notif-email`,
					),
			});
	}
	if (pushes.length)
		pending.push({ notificationIds: pushed, start: () => sendPushes(pushes) });
	// not inside a request (a script): send now
	if (!queue) await send(pending);
}
