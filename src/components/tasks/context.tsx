import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
	CREATE_TASK,
	type ProjectSummary,
	type SettingsMember,
	type TaskItem,
	type TaskPatch,
	UPDATE_TASK,
} from "#/graphql/operations";
import { hasRight } from "#/lib/permissions";
import { toast } from "#/lib/toast";

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
	) => Promise<TaskItem | undefined>;
	openTask: (id: string) => void;
	member: (id: string | null) => SettingsMember | undefined;
	project: (id: string) => ProjectSummary | undefined;
};

const TaskContext = createContext<Ctx | null>(null);

export function useTaskView() {
	const ctx = useContext(TaskContext);
	if (!ctx) throw new Error("useTaskView must be used inside TaskViewProvider");
	return ctx;
}

export function TaskViewProvider({
	slug,
	members,
	projects,
	children,
}: {
	slug: string;
	members: SettingsMember[];
	projects: ProjectSummary[];
	children: ReactNode;
}) {
	const router = useRouter();
	const [updateTask] = useMutation(UPDATE_TASK);
	// wait for the lists to refresh, so a new task is on screen when create resolves
	const [createTask] = useMutation(CREATE_TASK, {
		refetchQueries: TASK_REFETCH,
		awaitRefetchQueries: true,
	});

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
			create: async (input) => {
				const id = toast.pending(`Adding “${input.title}”…`);
				try {
					const { data } = await createTask({ variables: { slug, input } });
					const task = data?.createTask;
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
					toast.update(id, {
						title: "Couldn't add the task",
						desc: (error as Error).message,
						type: "error",
					});
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
	}, [slug, members, projects, router, updateTask, createTask]);

	return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
