import { eq, inArray } from "drizzle-orm";
import { db, tables } from "#/db";
import { github } from "#/lib/github-connect.server";

// A linked repo's GitHub Projects board: Zadaci makes one (linked to the repo, so it shows in the
// repo's Projects tab), puts every task's issue on it and keeps its Status in step with the task.
// shortcut: Zadaci → board only. GitHub sends board events to apps only for organizations, so
// moving a card on GitHub changes nothing here (closing the issue does, through the issue sync).

export type Board = NonNullable<
	(typeof tables.project_github.$inferSelect)["board"]
>;

/** Zadaci's statuses on the new board's Status field (Todo, In Progress, Done). */
const COLUMN: Record<string, string> = {
	idea: "Todo",
	todo: "Todo",
	in_progress: "In Progress",
	in_review: "In Progress",
	completed: "Done",
};

async function graphql<T>(token: string, query: string, variables: object) {
	const res = await github(token, "/graphql", "POST", { query, variables });
	const body = (await res.json().catch(() => ({}))) as {
		data?: T;
		errors?: { message: string }[];
		message?: string;
	};
	const problem =
		body.errors?.[0]?.message ??
		(res.ok ? undefined : (body.message ?? `status ${res.status}`));
	if (problem || !body.data)
		throw new Error(
			`GitHub's boards answered: ${(problem ?? "nothing").slice(0, 200)}`,
		);
	return body.data;
}

/** Make the project's board once (on linking, and on each hourly run until GitHub allows it). */
export async function ensureBoard(link: {
	projectId: string;
	repo: string;
	token: string;
	name: string;
	board: Board | null;
}) {
	if (link.board) return link.board;
	const save = (values: Partial<typeof tables.project_github.$inferInsert>) =>
		db
			.update(tables.project_github)
			.set(values)
			.where(eq(tables.project_github.project_id, link.projectId));
	const [owner, name] = link.repo.split("/");
	try {
		const { repository } = await graphql<{
			repository: { id: string; owner: { id: string } };
		}>(
			link.token,
			"query($o: String!, $n: String!) { repository(owner: $o, name: $n) { id owner { id } } }",
			{ o: owner, n: name },
		);
		const made = await graphql<{
			createProjectV2: {
				projectV2: {
					id: string;
					url: string;
					field: { id: string; options: { id: string; name: string }[] } | null;
				};
			};
		}>(
			link.token,
			`mutation($o: ID!, $r: ID!, $t: String!) {
				createProjectV2(input: { ownerId: $o, repositoryId: $r, title: $t }) {
					projectV2 { id url field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } }
				}
			}`,
			{ o: repository.owner.id, r: repository.id, t: link.name },
		);
		const { id, url, field } = made.createProjectV2.projectV2;
		if (!field) throw new Error("the new board has no Status field");
		const board = {
			id,
			url,
			field: field.id,
			options: Object.fromEntries(field.options.map((o) => [o.name, o.id])),
		};
		await save({ board, board_error: null });
		// cards on an earlier board (linked before, to this repo or another) start over
		const tasks = db
			.select({ id: tables.task.id })
			.from(tables.task)
			.where(eq(tables.task.project_id, link.projectId));
		await db
			.update(tables.task_github_issue)
			.set({ card: null, card_status: null })
			.where(inArray(tables.task_github_issue.task_id, tasks));
		return board;
	} catch (error) {
		const message = (error as Error).message;
		await save({
			board_error: /not accessible by integration/i.test(message)
				? "GitHub doesn't let apps make boards for personal accounts, only for organizations. Issues still sync."
				: message,
		});
		return null;
	}
}

/** Put a task's issue on the board in its status's column, or take it off when the task is gone.
 * True when it wrote to GitHub. */
export async function syncCard(
	token: string,
	board: Board,
	row: {
		task_id: string;
		repo: string;
		number: number;
		card: string | null;
		card_status: string | null;
	},
	status: string,
	gone: boolean,
) {
	const save = (card: string | null, cardStatus: string | null) =>
		db
			.update(tables.task_github_issue)
			.set({ card, card_status: cardStatus })
			.where(eq(tables.task_github_issue.task_id, row.task_id));
	if (gone) {
		if (!row.card) return false;
		await graphql(
			token,
			"mutation($p: ID!, $i: ID!) { deleteProjectV2Item(input: { projectId: $p, itemId: $i }) { deletedItemId } }",
			{ p: board.id, i: row.card },
		);
		await save(null, null);
		return true;
	}
	const column = COLUMN[status] ?? "Todo";
	if (row.card && row.card_status === column) return false;
	let card = row.card;
	if (!card) {
		const res = await github(token, `/repos/${row.repo}/issues/${row.number}`);
		if (!res.ok)
			throw new Error(
				`GitHub answered ${res.status} for ${row.repo}#${row.number}`,
			);
		const { node_id } = (await res.json()) as { node_id: string };
		const added = await graphql<{
			addProjectV2ItemById: { item: { id: string } };
		}>(
			token,
			"mutation($p: ID!, $c: ID!) { addProjectV2ItemById(input: { projectId: $p, contentId: $c }) { item { id } } }",
			{ p: board.id, c: node_id },
		);
		card = added.addProjectV2ItemById.item.id;
		await save(card, null);
	}
	const option = board.options[column];
	if (option)
		await graphql(
			token,
			`mutation($p: ID!, $i: ID!, $f: ID!, $o: String!) {
				updateProjectV2ItemFieldValue(input: { projectId: $p, itemId: $i, fieldId: $f, value: { singleSelectOptionId: $o } }) { projectV2Item { id } }
			}`,
			{ p: board.id, i: card, f: board.field, o: option },
		);
	await save(card, column);
	return true;
}
