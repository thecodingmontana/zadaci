import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { createElement } from "react";
import { db, tables } from "#/db";
import DailyDigest from "#/emails/daily-digest";
import { sendEmail } from "#/lib/email.server";
import { PREF_DEFAULTS } from "#/lib/preferences";
import { fromDay } from "#/lib/projects";
import { SITE_URL } from "#/lib/seo";

// The morning job behind /api/cron/daily, run hourly by a GitHub Action: once a person's
// local clock passes their digest hour (8:00 by default) it adds "due tomorrow" reminders
// to their inbox and, on weekdays, emails a digest of what's unread.

const DAY_MS = 86_400_000;

/** A person's local date, hour and weekday; an unknown or empty time zone counts as UTC. */
export function localClock(tz: string, now: Date) {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: tz || "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			weekday: "short",
			hourCycle: "h23",
		}).formatToParts(now);
	} catch {
		return localClock("UTC", now);
	}
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return {
		day: `${get("year")}-${get("month")}-${get("day")}`,
		hour: Number(get("hour")),
		weekend: get("weekday") === "Sat" || get("weekday") === "Sun",
		monday: get("weekday") === "Mon",
	};
}

type Person = { id: string; email: string; prefs: unknown };

/** Runs the morning job for everyone whose morning it is and who hasn't had it today. */
export async function runDaily(now = new Date()) {
	// shortcut: scans every user each hour, fine for thousands; page through them past that
	const people = await db
		.select({
			id: tables.user.id,
			email: tables.user.email,
			prefs: tables.user.preferences,
		})
		.from(tables.user);
	const result = { people: 0, reminders: 0, digests: 0 };
	for (const person of people) {
		const prefs = person.prefs as {
			tz?: string;
			autoTz?: string;
			digestHour?: string;
			notif?: Record<string, boolean>;
		} | null;
		const hour = Number(prefs?.digestHour ?? PREF_DEFAULTS.digestHour);
		const clock = localClock(prefs?.tz || prefs?.autoTz || "", now);
		if (clock.hour < hour) continue;
		// claiming the day first means a second, overlapping run skips this person
		const claimed = await db
			.insert(tables.daily_sent)
			.values({ user_id: person.id, day: clock.day })
			.onConflictDoNothing()
			.returning({ day: tables.daily_sent.day });
		if (!claimed.length) continue;
		result.people++;
		result.reminders += await remindDueTomorrow(person.id, clock.day);
		const digestOn =
			prefs?.notif?.email_digest ?? PREF_DEFAULTS.notif.email_digest;
		if (digestOn && !clock.weekend) {
			// Monday's digest also covers the weekend
			const since = new Date(now.getTime() - (clock.monday ? 3 : 1) * DAY_MS);
			if (await sendDigest(person, since, hour)) result.digests++;
		}
	}
	return result;
}

/** Adds an inbox reminder for each open task assigned to this person that's due tomorrow. */
async function remindDueTomorrow(userId: string, today: string) {
	// due dates are stored as UTC midnight of the chosen day
	const tomorrow = fromDay(today).getTime() + DAY_MS;
	const due = await db
		.select({
			task_id: tables.task.id,
			project_id: tables.task.project_id,
			workspace_id: tables.workspace_members.workspace_id,
		})
		.from(tables.task_assignees)
		.innerJoin(
			tables.workspace_members,
			eq(tables.workspace_members.id, tables.task_assignees.member_id),
		)
		.innerJoin(tables.task, eq(tables.task.id, tables.task_assignees.task_id))
		.innerJoin(tables.project, eq(tables.project.id, tables.task.project_id))
		.where(
			and(
				eq(tables.workspace_members.user_id, userId),
				isNull(tables.workspace_members.deleted_at),
				isNull(tables.task_assignees.deleted_at),
				isNull(tables.task.deleted_at),
				isNull(tables.task.completed_at),
				isNull(tables.task.archived_at),
				isNull(tables.project.deleted_at),
				gte(tables.task.due_date, new Date(tomorrow)),
				lt(tables.task.due_date, new Date(tomorrow + DAY_MS)),
			),
		);
	if (!due.length) return 0;
	await db.insert(tables.notification).values(
		due.map((t) => ({
			user_id: userId,
			type: "update",
			text: "is due tomorrow",
			...t,
		})),
	);
	return due.length;
}

/** Emails one summary of this person's unread notifications; false when there was nothing. */
async function sendDigest(person: Person, since: Date, hour: number) {
	const actor = alias(tables.user, "actor");
	const rows = await db
		.select({
			text: tables.notification.text,
			task_id: tables.notification.task_id,
			project_id: tables.notification.project_id,
			actor: actor.name,
			task: tables.task.name,
			slug: tables.workspace.slug,
			workspace: tables.workspace.name,
		})
		.from(tables.notification)
		.innerJoin(
			tables.workspace,
			eq(tables.workspace.id, tables.notification.workspace_id),
		)
		.leftJoin(actor, eq(actor.id, tables.notification.actor_id))
		.leftJoin(tables.task, eq(tables.task.id, tables.notification.task_id))
		.where(
			and(
				eq(tables.notification.user_id, person.id),
				isNull(tables.notification.read_at),
				gte(tables.notification.created_at, since),
			),
		)
		.orderBy(desc(tables.notification.created_at))
		.limit(30);
	if (!rows.length) return false;
	const appUrl = (process.env.BETTER_AUTH_URL ?? SITE_URL).replace(/\/$/, "");
	const items = rows.map((r) => {
		const about = r.task ? `“${r.task}”` : "";
		return {
			text: r.actor
				? `${r.actor} ${r.text}${about ? ` ${about}` : ""}`
				: [about, r.text].filter(Boolean).join(" "),
			workspace: r.workspace,
			link:
				r.task_id && r.project_id
					? `${appUrl}/w/${r.slug}/p/${r.project_id}?task=${r.task_id}`
					: `${appUrl}/w/${r.slug}/notifications`,
		};
	});
	await sendEmail(
		person.email,
		`Your Zadaci summary: ${items.length} ${items.length === 1 ? "update" : "updates"}`,
		createElement(DailyDigest, {
			items,
			hour,
			settingsLink: `${appUrl}/w/${rows[0].slug}/settings?sec=notif-email`,
			baseUrl: SITE_URL,
		}),
	);
	return true;
}
