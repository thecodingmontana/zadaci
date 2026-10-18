import {
	type ApolloCache,
	gql,
	type Reference,
	type TypedDocumentNode,
} from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { ConfirmModal } from "#/components/q/confirm";
import {
	CREATE_TASK,
	type ProjectSummary,
	type SettingsMember,
	TASK_FIELDS,
	type TaskItem,
	type TaskPatch,
	UPDATE_TASK,
} from "#/graphql/operations";
import { hasRight } from "#/lib/permissions";
import { toast } from "#/lib/toast";
import { count } from "#/lib/utils";

// What every task view needs: people and projects to show, who may edit what, and the
// actions views take. Edits are optimistic so drag and drop and pickers feel instant.

export const TASK_REFETCH = [
	"Tasks",
	"ProjectPage",
	"Projects",
	"Activity",
	"TaskDetail",
	"NotificationCounts",
];

type Ctx = {
	slug: string;
	members: SettingsMember[];
	projects: ProjectSummary[];
	meId: string;
	canEdit: (projectId: string) => boolean;
	update: (task: TaskItem, patch: TaskPatch) => Promise<void>;
	create: (
		input: TaskPatch & {
			projectId: string;
			title: string;
			parentId?: string | null;
		},
		/** quiet: no progress or success toast, for inline adds where the card is the feedback */
		opts?: { quiet?: boolean },
	) => Promise<TaskItem | undefined>;
	openTask: (id: string) => void;
	member: (id: string | null) => SettingsMember | undefined;
	project: (id: string) => ProjectSummary | undefined;
};

const TaskContext = createContext<Ctx | null>(null);

// the workspace's cache id, to add a new task to its cached task lists
const WORKSPACE_ID: TypedDocumentNode<
	{ workspace: { id: string } | null },
	{ slug: string }
> = gql`
	query WorkspaceId($slug: String!) {
		workspace(slug: $slug) {
			id
		}
	}
`;

/** Takes a task out of every cached task list (works inside optimistic updates, unlike evict). */
export function dropTaskFromLists(
	cache: ApolloCache,
	slug: string,
	taskId: string,
) {
	const ws = cache.readQuery({
		query: WORKSPACE_ID,
		variables: { slug },
	})?.workspace;
	if (!ws) return;
	cache.modify({
		id: cache.identify({ __typename: "Workspace", id: ws.id }),
		fields: {
			tasks(existing, { readField }) {
				return ((existing ?? []) as readonly Reference[]).filter(
					(r) => readField("id", r) !== taskId,
				);
			},
		},
	});
}

/** The args a cached `tasks(...)` field was fetched with, from its store name. */
const fieldArgs = (storeFieldName: string): Record<string, unknown> => {
	const json = storeFieldName.slice(storeFieldName.indexOf("(") + 1, -1);
	return json.startsWith("{") ? JSON.parse(json) : {};
};

export function useTaskView() {
	const ctx = useContext(TaskContext);
	if (!ctx) throw new Error("useTaskView must be used inside TaskViewProvider");
	return ctx;
}

export function TaskViewProvider({
	slug,
	members,
	projects,
	assignToMe,
	children,
}: {
	slug: string;
	members: SettingsMember[];
	projects: ProjectSummary[];
	/** new tasks go to you unless they name someone (My Tasks, so they don't vanish) */
	assignToMe?: boolean;
	children: ReactNode;
}) {
	const router = useRouter();
	// completing a task with open subtasks asks first; resolves with the answer
	const [asking, setAsking] = useState<{
		open: number;
		answer: (ok: boolean) => void;
	} | null>(null);
	const [updateTask] = useMutation(UPDATE_TASK);
	const [createTask] = useMutation(CREATE_TASK);

	const value = useMemo<Ctx>(() => {
		const byProject = new Map(projects.map((p) => [p.id, p]));
		const byMember = new Map(members.map((m) => [m.id, m]));
		return {
			slug,
			members,
			projects,
			meId: members.find((m) => m.isMe)?.id ?? "",
			canEdit: (projectId) =>
				hasRight(byProject.get(projectId)?.myAccess ?? null, "edit"),
			member: (id) => (id ? byMember.get(id) : undefined),
			project: (id) => byProject.get(id),
			update: async (task, patch) => {
				const open = task.subtaskCount - task.subtaskDone;
				if (
					patch.status === "completed" &&
					task.status !== "completed" &&
					open > 0 &&
					!(await new Promise<boolean>((answer) => setAsking({ open, answer })))
				)
					return;
				const { title, ...rest } = patch;
				try {
					await updateTask({
						variables: { slug, id: task.id, patch },
						optimisticResponse: {
							updateTask: {
								...task,
								...rest,
								...(title !== undefined && { name: title }),
								__typename: "Task",
							} as TaskItem,
						},
						// ticking a subtask off moves its parent's "2/5" at once
						update: (cache) => {
							const was = task.status === "completed";
							const now = (patch.status ?? task.status) === "completed";
							if (!task.parentId || was === now) return;
							cache.modify({
								id: cache.identify({ __typename: "Task", id: task.parentId }),
								fields: { subtaskDone: (n: number) => n + (now ? 1 : -1) },
							});
						},
						// moving between projects or completing a repeating task changes lists
						refetchQueries:
							patch.projectId || patch.status === "completed"
								? TASK_REFETCH
								: ["ProjectPage", "Projects", "TaskDetail"],
					});
				} catch (error) {
					toast.error("Couldn't update the task", {
						desc: (error as Error).message,
					});
				}
			},
			create: async (patch, opts) => {
				const meId = members.find((m) => m.isMe)?.id;
				const input =
					assignToMe && patch.assigneeId === undefined && meId
						? { ...patch, assigneeId: meId }
						: patch;
				const id = opts?.quiet
					? null
					: toast.pending(`Adding “${input.title}”…`);
				try {
					const now = new Date().toISOString();
					const { data } = await createTask({
						variables: { slug, input },
						// the card shows at once; the server's task replaces it when it answers
						optimisticResponse: {
							createTask: {
								__typename: "Task",
								id: `temp-${now}`,
								key: "",
								number: 0,
								name: input.title,
								status: input.status ?? "todo",
								priority: input.priority ?? "none",
								projectId: input.projectId,
								parentId: input.parentId ?? null,
								assigneeId: input.assigneeId ?? null,
								dueDate: input.dueDate ?? null,
								startDate: input.startDate ?? null,
								labels: input.labels ?? [],
								estimate: input.estimate ?? null,
								recur: input.recur ?? null,
								sortOrder: input.sortOrder ?? Number.MAX_SAFE_INTEGER,
								completedAt: null,
								archivedAt: null,
								createdAt: now,
								updatedAt: now,
								isFavorite: false,
								subtaskCount: 0,
								subtaskDone: 0,
								commentCount: 0,
								attachmentCount: 0,
								dependsOn: [],
							} as TaskItem,
						},
						// add it to the cached lists it belongs in instead of refetching them all
						update: (cache, { data }) => {
							const task = data?.createTask;
							if (!task) return;
							// a new subtask counts on its parent's card at once, not after a refetch
							if (input.parentId) {
								cache.modify({
									id: cache.identify({
										__typename: "Task",
										id: input.parentId,
									}),
									fields: {
										subtaskCount: (n: number) => n + 1,
										// and shows in the open task's list before the server answers
										subtasks: (list, { toReference }) => [
											...((list ?? []) as readonly Reference[]),
											toReference(task) as Reference,
										],
									},
								});
								return;
							}
							const ws = cache.readQuery({
								query: WORKSPACE_ID,
								variables: { slug },
							})?.workspace;
							if (!ws) return;
							const ref = cache.writeFragment({
								data: task,
								fragment: TASK_FIELDS,
								fragmentName: "TaskFields",
							});
							cache.modify({
								id: cache.identify({ __typename: "Workspace", id: ws.id }),
								fields: {
									tasks(existing, { storeFieldName, readField }) {
										const list = (existing ?? []) as readonly Reference[];
										const a = fieldArgs(storeFieldName);
										if (!ref) return list;
										if (a.projectId && a.projectId !== task.projectId)
											return list;
										if (a.assigneeId && a.assigneeId !== task.assigneeId)
											return list;
										if (list.some((r) => readField("id", r) === task.id))
											return list;
										return [...list, ref];
									},
								},
							});
						},
						// stats and counts are computed on the server; a subtask changes its parent
						refetchQueries: input.parentId
							? TASK_REFETCH
							: ["ProjectPage", "Projects", "NotificationCounts"],
					});
					const task = data?.createTask;
					if (id !== null)
						toast.update(id, {
							title: task ? `Created ${task.key}` : `Added “${input.title}”`,
							type: "success",
							action: task
								? {
										label: "Open",
										onClick: () =>
											router.navigate({
												to: ".",
												search: ((prev: Record<string, unknown>) => ({
													...prev,
													task: task.id,
												})) as never,
											}),
									}
								: undefined,
						});
					return task;
				} catch (error) {
					const failed = {
						title: "Couldn't add the task",
						desc: (error as Error).message,
						type: "error" as const,
					};
					if (id !== null) toast.update(id, failed);
					else toast(failed);
				}
			},
			openTask: (id) =>
				router.navigate({
					to: ".",
					search: ((prev: Record<string, unknown>) => ({
						...prev,
						task: id,
					})) as never,
				}),
		};
	}, [slug, members, projects, assignToMe, router, updateTask, createTask]);

	return (
		<TaskContext.Provider value={value}>
			{children}
			<ConfirmModal
				open={!!asking}
				onOpenChange={(o) => {
					if (o) return;
					asking?.answer(false);
					setAsking(null);
				}}
				title="Complete it with open subtasks?"
				body={`${count(asking?.open ?? 0, "subtask is", "subtasks are")} still open. They'll stay open if you complete the task.`}
				ok="Complete anyway"
				icon="icon-[solar--checklist-minimalistic-linear]"
				onConfirm={() => {
					asking?.answer(true);
					setAsking(null);
				}}
			/>
		</TaskContext.Provider>
	);
}
