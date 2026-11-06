import { type SQL, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db, tables } from "#/db";
import { inTurn } from "#/lib/admin.server";

// The admin Dashboard: totals, what people do with Zadaci day by day (60 days, so the last 30
// compare with the 30 before), and how it splits up. Counts only, never what anyone wrote.

const DAYS = 60;
const HEATMAP_DAYS = 182;

/** The last `days` UTC days, oldest first, as YYYY-MM-DD. */
function dayKeys(days: number) {
	const today = Date.UTC(
		new Date().getUTCFullYear(),
		new Date().getUTCMonth(),
		new Date().getUTCDate(),
	);
	return Array.from({ length: days }, (_, i) =>
		new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
	);
}

/** Rows per UTC day of `column` over the last `days` (distinct `distinct` when given). */
async function perDay(
	table: PgTable,
	column: PgColumn,
	days: number,
	options: { where?: SQL; distinct?: PgColumn } = {},
) {
	const counted = options.distinct
		? sql`count(distinct ${options.distinct})::int`
		: sql`count(*)::int`;
	const rows = (await db.execute(sql`
		select to_char(date_trunc('day', ${column} at time zone 'UTC'), 'YYYY-MM-DD') as day, ${counted} as n
		from ${table}
		where ${column} > now() - make_interval(days => ${days}) ${options.where ? sql`and ${options.where}` : sql``}
		group by 1
	`)) as unknown as { day: string; n: number }[];
	return new Map(rows.map((r) => [r.day, Number(r.n)]));
}

/** Rows grouped by a column, biggest first. */
async function split(table: PgTable, column: PgColumn | SQL, where?: SQL) {
	const rows = (await db.execute(sql`
		select coalesce(${column}::text, 'none') as key, count(*)::int as n from ${table}
		${where ? sql`where ${where}` : sql``}
		group by 1 order by 2 desc
	`)) as unknown as { key: string; n: number }[];
	return rows.map((r) => ({ key: r.key, n: Number(r.n) }));
}

const total = async (query: SQL) =>
	Number(((await db.execute(query)) as unknown as { n: number }[])[0]?.n ?? 0);

/** Distinct people who changed something, in the last 30 days and the 30 before. */
async function activePeople() {
	const t = tables;
	const rows = (await db.execute(sql`
		select
			count(distinct ${t.activity.actor_id}) filter (where ${t.activity.created_at} > now() - interval '30 days')::int as now,
			count(distinct ${t.activity.actor_id}) filter (where ${t.activity.created_at} <= now() - interval '30 days')::int as before
		from ${t.activity} where ${t.activity.created_at} > now() - interval '60 days'
	`)) as unknown as { now: number; before: number }[];
	return {
		now: Number(rows[0]?.now ?? 0),
		before: Number(rows[0]?.before ?? 0),
	};
}

export async function adminDashboard() {
	const t = tables;
	const [people, workspaces, projects, tasks, signedIn, active] = await inTurn([
		() => total(sql`select count(*)::int as n from ${t.user}`),
		() => total(sql`select count(*)::int as n from ${t.workspace}`),
		() =>
			total(
				sql`select count(*)::int as n from ${t.project} where ${t.project.deleted_at} is null`,
			),
		() =>
			total(
				sql`select count(*)::int as n from ${t.task} where ${t.task.deleted_at} is null`,
			),
		() =>
			total(
				sql`select count(distinct ${t.session.userId})::int as n from ${t.session} where ${t.session.expiresAt} > now()`,
			),
		() => activePeople(),
	]);
	return {
		at: new Date().toISOString(),
		totals: { people, workspaces, projects, tasks, signedIn, active },
		...(await adminAnalytics()),
	};
}

async function adminAnalytics() {
	const t = tables;
	const [
		signups,
		active,
		signIns,
		created,
		completed,
		comments,
		chat,
		assistant,
		errGithub,
		errCron,
		errClient,
		heat,
	] = await inTurn([
		() => perDay(t.user, t.user.createdAt, DAYS),
		() =>
			perDay(t.activity, t.activity.created_at, DAYS, {
				distinct: t.activity.actor_id,
			}),
		() => perDay(t.session, t.session.createdAt, DAYS),
		() => perDay(t.task, t.task.created_at, DAYS),
		() => perDay(t.task, t.task.completed_at, DAYS),
		() => perDay(t.comment, t.comment.created_at, DAYS),
		() => perDay(t.chat_message, t.chat_message.created_at, DAYS),
		() =>
			perDay(t.ai_message, t.ai_message.created_at, DAYS, {
				where: sql`${t.ai_message.role} = 'user'`,
			}),
		() =>
			perDay(t.error_log, t.error_log.at, DAYS, {
				where: sql`${t.error_log.source} = 'github'`,
			}),
		() =>
			perDay(t.error_log, t.error_log.at, DAYS, {
				where: sql`${t.error_log.source} = 'cron'`,
			}),
		() =>
			perDay(t.error_log, t.error_log.at, DAYS, {
				where: sql`${t.error_log.source} = 'client'`,
			}),
		() => perDay(t.activity, t.activity.created_at, HEATMAP_DAYS),
	]);
	const at = (m: Map<string, number>, day: string) => m.get(day) ?? 0;
	const daily = dayKeys(DAYS).map((day) => ({
		day,
		signups: at(signups, day),
		active: at(active, day),
		signIns: at(signIns, day),
		created: at(created, day),
		completed: at(completed, day),
		comments: at(comments, day),
		chat: at(chat, day),
		assistant: at(assistant, day),
		github: at(errGithub, day),
		cron: at(errCron, day),
		client: at(errClient, day),
	}));

	const [statuses, providers, models, workspaces] = await inTurn([
		() => split(t.task, t.task.status, sql`${t.task.deleted_at} is null`),
		() => split(t.account, t.account.providerId),
		() =>
			split(
				t.ai_message,
				t.ai_message.model,
				sql`${t.ai_message.role} = 'assistant' and ${t.ai_message.created_at} > now() - interval '30 days'`,
			),
		() =>
			db.execute(sql`
			select w.slug, w.name,
				(select count(*)::int from ${t.workspace_members} m where m.workspace_id = w.id and m.deleted_at is null) as members,
				(select count(*)::int from ${t.task} k join ${t.project} p on p.id = k.project_id where p.workspace_id = w.id and k.deleted_at is null) as tasks,
				(select max(a.created_at) from ${t.activity} a where a.workspace_id = w.id) as last_active
			from ${t.workspace} w
			order by tasks desc
			limit 10
		`) as unknown as Promise<
				{
					slug: string;
					name: string;
					members: number;
					tasks: number;
					last_active: string | Date | null;
				}[]
			>,
	]);

	return {
		daily,
		heatmap: dayKeys(HEATMAP_DAYS).map((day) => ({
			date: day,
			value: at(heat, day),
		})),
		statuses,
		providers,
		models: models.slice(0, 6),
		workspaces: workspaces.map((w) => ({
			slug: w.slug,
			name: w.name,
			members: Number(w.members),
			tasks: Number(w.tasks),
			lastActive: w.last_active ? new Date(w.last_active).toISOString() : null,
		})),
	};
}

export type AdminDashboard = Awaited<ReturnType<typeof adminDashboard>>;
