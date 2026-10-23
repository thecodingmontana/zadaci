import { useMutation } from "@apollo/client/react";
import { useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "#/components/q/menu";
import { StatusIcon } from "#/components/q/status-icon";
import {
	ARCHIVE_TASK,
	DELETE_TASKS,
	DUPLICATE_TASK,
	type TaskItem,
	TOGGLE_TASK_FAVORITE,
} from "#/graphql/operations";
import { PRIORITIES, TASK_STATUSES } from "#/lib/tasks";
import { copy, toast } from "#/lib/toast";
import { PrIcon } from "./bits";
import {
	dropTaskFromLists,
	TASK_REFETCH,
	useTaskView,
	useUndoDelete,
} from "./context";

// The task "…" menu (reference context menu for tasks).

export function TaskMenu({
	t,
	className = "ibtn ibtn-sm",
}: {
	t: TaskItem;
	className?: string;
}) {
	const { slug, update, openTask, canEdit, members, projects } = useTaskView();
	const [deleting, setDeleting] = useState(false);
	const taskRef = { __typename: "Task", id: t.id } as const;
	// favorite flips the cached flag; archive and delete drop the task from the cache, so
	// every list updates at once and only server-computed stats and counts refetch
	const [favorite] = useMutation(TOGGLE_TASK_FAVORITE, {
		update: (cache, { data }) =>
			cache.modify({
				id: cache.identify(taskRef),
				fields: { isFavorite: () => !!data?.toggleTaskFavorite },
			}),
	});
	const [duplicate] = useMutation(DUPLICATE_TASK, {
		refetchQueries: TASK_REFETCH,
	});
	const [archive] = useMutation(ARCHIVE_TASK);
	const [remove] = useMutation(DELETE_TASKS, {
		// gone from the lists at once; the server's answer confirms (or rolls it back)
		optimisticResponse: { deleteTasks: 1 },
		update: (cache) => dropTaskFromLists(cache, slug, t.id),
		refetchQueries: ["ProjectPage", "Projects", "NotificationCounts"],
	});
	const undo = useUndoDelete(slug);
	const editable = canEdit(t.projectId);
	const done = t.status === "completed";
	return (
		<>
			<Menu>
				<MenuTrigger
					className={className}
					aria-label="More actions"
					onClick={(e) => e.stopPropagation()}
				>
					<span
						className="icon-[solar--menu-dots-bold] size-[15px]"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={220}>
					<MenuItem
						icon="icon-[solar--sidebar-minimalistic-linear]"
						onSelect={() => openTask(t.id)}
					>
						Open
					</MenuItem>
					{editable && (
						<MenuItem
							icon={
								done
									? "icon-[solar--restart-linear]"
									: "icon-[solar--check-circle-linear]"
							}
							onSelect={() =>
								update(t, { status: done ? "todo" : "completed" })
							}
						>
							{done ? "Reopen" : "Mark complete"}
						</MenuItem>
					)}
					{editable && (
						<>
							<MenuSeparator />
							<MenuSub>
								<MenuSubTrigger icon="icon-[solar--record-circle-linear]">
									Status…
								</MenuSubTrigger>
								<MenuSubContent width={200}>
									{TASK_STATUSES.map((s) => (
										<MenuItem
											key={s.id}
											checked={t.status === s.id}
											onSelect={() => update(t, { status: s.id })}
										>
											<StatusIcon status={s.id} />
											{s.name}
										</MenuItem>
									))}
								</MenuSubContent>
							</MenuSub>
							<MenuSub>
								<MenuSubTrigger icon="icon-[solar--user-linear]">
									Assign to…
								</MenuSubTrigger>
								<MenuSubContent width={220}>
									<MenuItem
										checked={!t.assigneeIds.length}
										onSelect={() => update(t, { assigneeIds: [] })}
									>
										Unassigned
									</MenuItem>
									{members.map((m) => (
										<MenuItem
											key={m.id}
											checked={t.assigneeIds.includes(m.id)}
											onSelect={() =>
												update(t, {
													assigneeIds: t.assigneeIds.includes(m.id)
														? t.assigneeIds.filter((id) => id !== m.id)
														: [...t.assigneeIds, m.id],
												})
											}
										>
											<Av name={m.name} image={m.image} className="sm" />
											{m.isMe ? `${m.name} (you)` : m.name}
										</MenuItem>
									))}
								</MenuSubContent>
							</MenuSub>
							<MenuSub>
								<MenuSubTrigger icon="icon-[solar--chart-2-linear]">
									Priority…
								</MenuSubTrigger>
								<MenuSubContent width={200}>
									{PRIORITIES.map((p) => (
										<MenuItem
											key={p.id}
											checked={t.priority === p.id}
											onSelect={() => update(t, { priority: p.id })}
										>
											<PrIcon p={p.id} />
											{p.name}
										</MenuItem>
									))}
								</MenuSubContent>
							</MenuSub>
							{!t.parentId && (
								<MenuSub>
									<MenuSubTrigger icon="icon-[solar--folder-path-connect-linear]">
										Move to project…
									</MenuSubTrigger>
									<MenuSubContent width={220}>
										{projects
											.filter((p) => p.status !== "complete" && canEdit(p.id))
											.map((p) => (
												<MenuItem
													key={p.id}
													checked={t.projectId === p.id}
													onSelect={() =>
														p.id !== t.projectId &&
														update(t, { projectId: p.id })
													}
												>
													<span
														className="pdot"
														style={
															{
																"--c": projectColor(p.color),
															} as React.CSSProperties
														}
													/>
													{p.title}
												</MenuItem>
											))}
									</MenuSubContent>
								</MenuSub>
							)}
						</>
					)}
					<MenuSeparator />
					<MenuItem
						icon="icon-[solar--star-linear]"
						onSelect={() =>
							toast
								.promise(favorite({ variables: { slug, id: t.id } }), {
									loading: t.isFavorite
										? "Removing from favorites…"
										: "Adding to favorites…",
									success: t.isFavorite
										? "Removed from favorites"
										: "Added to favorites",
									error: "Couldn't update favorites",
								})
								.catch(() => {})
						}
					>
						{t.isFavorite ? "Remove from favorites" : "Add to favorites"}
					</MenuItem>
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={() =>
							copy(`${location.origin}/w/${slug}/p/${t.projectId}?task=${t.id}`)
						}
					>
						Copy link
					</MenuItem>
					{editable && (
						<>
							<MenuItem
								icon="icon-[solar--copy-linear]"
								onSelect={() => {
									const id = toast.pending(`Duplicating “${t.name}”…`);
									duplicate({ variables: { slug, id: t.id } })
										.then(({ data }) =>
											toast.update(id, {
												title: "Task duplicated",
												type: "success",
												action: data
													? {
															label: "Open",
															onClick: () => openTask(data.duplicateTask.id),
														}
													: undefined,
											}),
										)
										.catch((error: Error) =>
											toast.update(id, {
												title: "Couldn't duplicate the task",
												desc: error.message,
												type: "error",
											}),
										);
								}}
							>
								Duplicate
							</MenuItem>
							<MenuItem
								icon="icon-[solar--archive-linear]"
								onSelect={() => {
									const id = toast.pending(`Archiving “${t.name}”…`);
									archive({
										variables: { slug, id: t.id, archived: true },
										optimisticResponse: {
											archiveTask: {
												...t,
												archivedAt: new Date().toISOString(),
												__typename: "Task",
											} as TaskItem,
										},
										update: (cache) => dropTaskFromLists(cache, slug, t.id),
										refetchQueries: [
											"ProjectPage",
											"Projects",
											"NotificationCounts",
											"Archive",
										],
									})
										.then(() =>
											toast.update(id, {
												title: `Archived “${t.name}”`,
												type: "success",
												action: {
													label: "Undo",
													onClick: () =>
														archive({
															variables: { slug, id: t.id, archived: false },
															// the task comes back: refresh the lists it belongs in
															refetchQueries: [...TASK_REFETCH, "Archive"],
														}),
												},
											}),
										)
										.catch((error: Error) =>
											toast.update(id, {
												title: "Couldn't archive the task",
												desc: error.message,
												type: "error",
											}),
										);
								}}
							>
								Archive
							</MenuItem>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--trash-bin-minimalistic-linear]"
								danger
								onSelect={() => setDeleting(true)}
							>
								Delete
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${t.name}”?`}
				body={`${t.subtaskCount ? `Its ${t.subtaskCount} subtask${t.subtaskCount > 1 ? "s" : ""} will be deleted too. ` : ""}This can't be undone.`}
				ok="Delete task"
				danger
				onConfirm={async () => {
					const id = toast.pending(`Deleting “${t.name}”…`);
					try {
						await remove({ variables: { slug, ids: [t.id] } });
						toast.update(id, {
							title: "Task deleted",
							type: "success",
							action: undo([t.id]),
						});
					} catch (error) {
						toast.update(id, {
							title: "Couldn't delete the task",
							desc: (error as Error).message,
							type: "error",
						});
					}
				}}
			/>
		</>
	);
}
