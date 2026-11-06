import { desc, eq, gt, sql } from "drizzle-orm";
import { db, tables } from "#/db";

// The admin area's System and Directory pages (the Dashboard is admin-analytics.server).
// Health and lists only: no task text, notes or messages.

const DAY = 86_400_000;
const n = sql<number>`count(*)::int`;

/** System: the hourly job, kept errors, GitHub links and the database. */
export async function adminSystem() {
	const t = tables;
	const [jobs, errors, github, sizeRows, biggest] = await Promise.all([
		db.select().from(t.job_run),
		db.select().from(t.error_log).orderBy(desc(t.error_log.at)).limit(200),
		db
			.select({
				repo: t.project_github.repo,
				project: t.project.title,
				workspace: t.workspace.slug,
				viaApp: t.project_github.via_app,
				boardUrl: sql<string | null>`${t.project_github.board}->>'url'`,
				boardError: t.project_github.board_error,
				linkedBy: t.user.name,
				issues: sql<number>`(select count(*)::int from ${t.task_github_issue} where lower(${t.task_github_issue.repo}) = lower(${t.project_github.repo}))`,
			})
			.from(t.project_github)
			.innerJoin(t.project, eq(t.project.id, t.project_github.project_id))
			.innerJoin(t.workspace, eq(t.workspace.id, t.project.workspace_id))
			.leftJoin(t.user, eq(t.user.id, t.project_github.connected_by)),
		db.execute(
			sql`select pg_database_size(current_database())::bigint as size`,
		) as unknown as Promise<{ size: string }[]>,
		db.execute(sql`
			select relname as name, pg_total_relation_size(relid)::bigint as bytes, n_live_tup::bigint as rows
			from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 8
		`) as unknown as Promise<{ name: string; bytes: string; rows: string }[]>,
	]);
	// errors per UTC day and source, last 30 days, for the stacked chart
	const perDay = (await db.execute(sql`
		select to_char(date_trunc('day', ${t.error_log.at} at time zone 'UTC'), 'YYYY-MM-DD') as day,
			${t.error_log.source} as source, count(*)::int as n
		from ${t.error_log} where ${t.error_log.at} > now() - interval '30 days'
		group by 1, 2
	`)) as unknown as { day: string; source: string; n: number }[];
	const today = Date.UTC(
		new Date().getUTCFullYear(),
		new Date().getUTCMonth(),
		new Date().getUTCDate(),
	);
	const errorsDaily = Array.from({ length: 30 }, (_, i) => {
		const day = new Date(today - (29 - i) * DAY).toISOString().slice(0, 10);
		const of = (source: string) =>
			Number(perDay.find((r) => r.day === day && r.source === source)?.n ?? 0);
		return {
			day,
			github: of("github"),
			cron: of("cron"),
			client: of("client"),
		};
	});
	const errorsDay = await db
		.select({ source: t.error_log.source, n })
		.from(t.error_log)
		.where(gt(t.error_log.at, new Date(Date.now() - DAY)))
		.groupBy(t.error_log.source);

	return {
		jobs: jobs.map((j) => ({
			name: j.name,
			at: j.at.toISOString(),
			ok: j.ok,
			result: (j.result ?? {}) as Record<
				string,
				string | number | boolean | null
			>,
		})),
		errors: errors.map((e) => ({
			id: e.id,
			source: e.source,
			message: e.message,
			at: e.at.toISOString(),
		})),
		errorsDay: Object.fromEntries(errorsDay.map((e) => [e.source, e.n])),
		errorsDaily,
		github: github.map((g) => ({ ...g, linkedBy: g.linkedBy ?? null })),
		database: {
			bytes: Number(sizeRows[0]?.size ?? 0),
			biggest: biggest.map((b) => ({
				name: b.name,
				bytes: Number(b.bytes),
				rows: Number(b.rows),
			})),
		},
	};
}

/** Directory: everyone who signed up and every workspace, newest first. */
export async function adminDirectory() {
	const t = tables;
	// shortcut: the newest 500 of each, searched in the browser; page on the server past that
	const [people, workspaces] = await Promise.all([
		db.execute(sql`
			select u.id, u.name, u.email, u.created_at as joined, u.two_factor_enabled as two_factor,
				(select count(*)::int from ${t.workspace_members} m where m.user_id = u.id and m.deleted_at is null) as workspaces,
				(select max(s.updated_at) from ${t.session} s where s.user_id = u.id) as last_seen,
				(select string_agg(distinct a.provider_id, ',') from ${t.account} a where a.user_id = u.id) as methods
			from ${t.user} u order by u.created_at desc limit 500
		`) as unknown as Promise<
			{
				id: string;
				name: string;
				email: string;
				joined: string | Date;
				two_factor: boolean | null;
				workspaces: number;
				last_seen: string | Date | null;
				methods: string | null;
			}[]
		>,
		db.execute(sql`
			select w.id, w.name, w.slug, w.created_at as created,
				(select count(*)::int from ${t.workspace_members} m where m.workspace_id = w.id and m.deleted_at is null) as members,
				(select count(*)::int from ${t.project} p where p.workspace_id = w.id and p.deleted_at is null) as projects,
				(select count(*)::int from ${t.task} k join ${t.project} p on p.id = k.project_id where p.workspace_id = w.id and k.deleted_at is null) as tasks,
				(select max(a.created_at) from ${t.activity} a where a.workspace_id = w.id) as last_active
			from ${t.workspace} w order by w.created_at desc limit 500
		`) as unknown as Promise<
			{
				id: string;
				name: string;
				slug: string;
				created: string | Date;
				members: number;
				projects: number;
				tasks: number;
				last_active: string | Date | null;
			}[]
		>,
	]);
	const iso = (d: string | Date | null) =>
		d ? new Date(d).toISOString() : null;
	return {
		people: people.map((p) => ({
			id: p.id,
			name: p.name,
			email: p.email,
			joined: iso(p.joined) ?? "",
			twoFactor: !!p.two_factor,
			workspaces: Number(p.workspaces),
			lastSeen: iso(p.last_seen),
			methods: (p.methods ?? "").split(",").filter(Boolean),
		})),
		workspaces: workspaces.map((w) => ({
			id: w.id,
			name: w.name,
			slug: w.slug,
			created: iso(w.created) ?? "",
			members: Number(w.members),
			projects: Number(w.projects),
			tasks: Number(w.tasks),
			lastActive: iso(w.last_active),
		})),
	};
}

export type AdminSystem = Awaited<ReturnType<typeof adminSystem>>;
export type AdminDirectory = Awaited<ReturnType<typeof adminDirectory>>;
