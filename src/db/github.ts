import {
	boolean,
	index,
	integer,
	jsonb,
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
	/** sealed too; GitHub App sign-ins that expire (8 hours) are renewed with it */
	refresh_token: text("refresh_token"),
	expires_at: when("expires_at"),
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
		/** linked through the Zadaci GitHub App (its one webhook), not a webhook on this repo */
		via_app: boolean("via_app").notNull().default(false),
		/** merges are applied as this person (their role, their name in the activity) */
		connected_by: varchar("connected_by", { length: 16 }).references(
			() => user.id,
			{ onDelete: "set null" },
		),
		/** the GitHub Projects board Zadaci made for this repo, and its Status field's options */
		board: jsonb("board").$type<{
			id: string;
			url: string;
			field: string;
			options: Record<string, string>;
		}>(),
		/** why GitHub wouldn't make the board (shown in the project's GitHub window) */
		board_error: text("board_error"),
		/** a sync of this project is running until then (one at a time; a crashed one's claim runs out) */
		sync_until: when("sync_until"),
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

/** A task's GitHub issue (projects linked through the GitHub App sync both ways). */
export const task_github_issue = pgTable(
	"task_github_issue",
	{
		task_id: varchar("task_id", { length: 16 })
			.primaryKey()
			.references(() => task.id, { onDelete: "cascade" }),
		repo: text("repo").notNull(),
		/** null while a sync is opening the issue (it claims the task first, so two syncs never open two) */
		number: integer("number"),
		/** fingerprint of what was last written either way, so an echo of our own change is skipped */
		synced_hash: text("synced_hash").notNull().default(""),
		/** the issue's card on the project's board, and the Status last written to it */
		card: text("card"),
		card_status: text("card_status"),
		updated_at: when("updated_at").notNull().defaultNow(),
	},
	(t) => [uniqueIndex("task_github_issue_repo_number").on(t.repo, t.number)],
);
