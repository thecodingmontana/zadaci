import {
	index,
	integer,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { project, task } from "./project";
import { user } from "./user";
import { generateNanoId, pgTable } from "./utils";

// GitHub pull requests on tasks: a project linked to one repo (GitHub calls our webhook for its
// pull requests), and the PRs that mention a task's key.

const when = (name: string) =>
	timestamp(name, { mode: "date", withTimezone: true });

/** Someone's GitHub account, connected once in Settings → Connected apps (to list repos and add webhooks). */
export const github_account = pgTable("github_account", {
	user_id: varchar("user_id", { length: 16 })
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	login: text("login").notNull(),
	/** the OAuth token, sealed like AI keys (keys.server.ts): only ciphertext is stored */
	token: text("token").notNull(),
	created_at: when("created_at").notNull().defaultNow(),
});

export const project_github = pgTable(
	"project_github",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		project_id: varchar("project_id", { length: 16 })
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		/** "owner/name" */
		repo: text("repo").notNull(),
		/** the webhook secret is derived from this and the app's secret (never stored); a new one on reconnect */
		nonce: text("nonce").notNull(),
		/** merges are applied as this person (their role, their name in the activity) */
		connected_by: varchar("connected_by", { length: 16 }).references(
			() => user.id,
			{ onDelete: "set null" },
		),
		created_at: when("created_at").notNull().defaultNow(),
	},
	(t) => [uniqueIndex("project_github_project_unique").on(t.project_id)],
);

export const task_github_pr = pgTable(
	"task_github_pr",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		task_id: varchar("task_id", { length: 16 })
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		repo: text("repo").notNull(),
		number: integer("number").notNull(),
		title: text("title").notNull(),
		url: text("url").notNull(),
		/** open, merged or closed */
		state: varchar("state", { length: 10 }).notNull(),
		updated_at: when("updated_at").notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("task_github_pr_unique").on(t.task_id, t.repo, t.number),
		index("task_github_pr_task_idx").on(t.task_id),
	],
);
