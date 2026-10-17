import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import {
	createFileRoute,
	notFound,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { PIcon } from "#/components/projects/bits";
import { ConfirmModal } from "#/components/q/confirm";
import { StatusIcon } from "#/components/q/status-icon";
import {
	ARCHIVE,
	ARCHIVE_PROJECT,
	ARCHIVE_TASK,
	DELETE_PROJECT,
	DELETE_TASKS,
} from "#/graphql/operations";
import { can, hasRight } from "#/lib/permissions";
import { PSTAT } from "#/lib/projects";
import { reloadOnEnter } from "#/lib/routing";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Ported from the reference app's Archive page: archived tasks and projects, restored or
// deleted for good.

const REFETCH = { refetchQueries: ["Archive", "Shell"] };

export const Route = createFileRoute("/_authed/w/$slug/archive")({
	validateSearch: z.object({ tab: z.enum(["tasks", "projects"]).optional() }),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const { data } = await context.apolloClient.query({
			query: ARCHIVE,
			variables: { slug: params.slug },
			fetchPolicy: "network-only",
		});
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Archive - Zadaci" }] }),
	component: ArchivePage,
});

type Pending = { title: string; body: string; run: () => Promise<unknown> };

function ArchivePage() {
	const { slug } = Route.useParams();
	const { tab = "tasks" } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const router = useRouter();
	const { data } = useSuspenseQuery(ARCHIVE, { variables: { slug } });
	const [archiveTask] = useMutation(ARCHIVE_TASK, REFETCH);
	const [archiveProject] = useMutation(ARCHIVE_PROJECT, REFETCH);
	const [deleteTasks] = useMutation(DELETE_TASKS, REFETCH);
	const [deleteProject] = useMutation(DELETE_PROJECT, REFETCH);
	const [pending, setPending] = useState<Pending | null>(null);
	const w = data.workspace;
	if (!w) return null;

	const title = (id: string) => w.projects.find((p) => p.id === id)?.title;
	const tasks = w.tasks
		.filter((t) => t.archivedAt)
		.sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
	const projects = w.archivedProjects;
	const when = (at: string | null) => (at ? `Archived ${ago(at)}` : "Archived");
	const fail = (what: string) => (error: Error) =>
		toast.error(`Couldn't ${what}`, { desc: error.message });

	const body =
		tab === "tasks" ? (
			tasks.length ? (
				<div className="panel" style={{ overflow: "hidden" }}>
					{tasks.map((t) => (
						<Row
							key={t.id}
							lead={<StatusIcon status={t.status} size={15} />}
							title={t.name}
							sub={
								<>
									<span className="mono">{t.key}</span> · {title(t.projectId)}
								</>
							}
							when={when(t.archivedAt)}
							onRestore={() =>
								archiveTask({ variables: { slug, id: t.id, archived: false } })
									.then(() =>
										toast.success(`Restored “${t.name}”`, {
											action: {
												label: "Open",
												onClick: () =>
													router.navigate({
														to: "/w/$slug",
														params: { slug },
														search: { task: t.id },
													}),
											},
										}),
									)
									.catch(fail("restore the task"))
							}
							onDelete={() =>
								setPending({
									title: "Delete task permanently?",
									body: `${t.name}, its subtasks, comments, and attachments will be deleted for everyone. This can't be undone.`,
									run: () =>
										deleteTasks({ variables: { slug, ids: [t.id] } })
											.then(() => toast.success(`Deleted “${t.name}”`))
											.catch(fail("delete the task")),
								})
							}
						/>
					))}
				</div>
			) : (
				<Empty
					title="No archived tasks"
					body="Archive finished or abandoned tasks to keep boards focused. They wait here until you restore them."
				/>
			)
		) : projects.length ? (
			<div className="panel" style={{ overflow: "hidden" }}>
				{projects.map((p) => {
					const total =
						w.projectStats.find((s) => s.projectId === p.id)?.total ?? 0;
					return (
						<Row
							key={p.id}
							lead={<PIcon icon={p.icon} color={p.color} px={14} />}
							title={p.title}
							sub={`${total} task${total === 1 ? "" : "s"} · ${PSTAT[p.status as keyof typeof PSTAT]?.name ?? p.status}`}
							when={when(p.archivedAt)}
							onRestore={
								hasRight(p.myAccess, "edit")
									? () =>
											archiveProject({
												variables: { slug, projectId: p.id, archived: false },
											})
												.then(() => toast.success(`Restored ${p.title}`))
												.catch(fail("restore the project"))
									: undefined
							}
							onDelete={
								can(w.role, "deleteProjects")
									? () =>
											setPending({
												title: `Delete ${p.title}?`,
												body: `${total} task${total === 1 ? "" : "s"}, their comments, and files will be deleted for everyone. This can't be undone.`,
												run: () =>
													deleteProject({
														variables: { slug, projectId: p.id },
													})
														.then(() => toast.success(`Deleted ${p.title}`))
														.catch(fail("delete the project")),
											})
									: undefined
							}
						/>
					);
				})}
			</div>
		) : (
			<Empty
				title="No archived projects"
				body="Archived projects disappear from the sidebar and project lists but keep every task, file, and comment."
			/>
		);

	return (
		<div className="page" style={{ maxWidth: 900 }}>
			<div className="ph">
				<div>
					<h1>Archive</h1>
					<p>
						Archived work is hidden everywhere else. Restore it any time, or
						delete it for good.
					</p>
				</div>
			</div>
			<div
				className="tabs"
				style={{ marginBottom: 14 }}
				role="tablist"
				aria-label="Archive"
			>
				{(
					[
						["tasks", "Tasks", tasks.length],
						["projects", "Projects", projects.length],
					] as const
				).map(([k, n, c]) => (
					<button
						key={k}
						type="button"
						role="tab"
						aria-selected={tab === k}
						className={cn("tab", tab === k && "on")}
						onClick={() =>
							navigate({
								search: { tab: k === "tasks" ? undefined : k },
								replace: true,
							})
						}
					>
						{n}
						<span className="cnt">{c}</span>
					</button>
				))}
			</div>
			{body}
			<ConfirmModal
				open={!!pending}
				onOpenChange={(o) => !o && setPending(null)}
				title={pending?.title ?? ""}
				body={pending?.body ?? ""}
				ok="Delete permanently"
				danger
				onConfirm={async () => {
					await pending?.run();
				}}
			/>
		</div>
	);
}

function Row({
	lead,
	title,
	sub,
	when,
	onRestore,
	onDelete,
}: {
	lead: ReactNode;
	title: string;
	sub: ReactNode;
	when: string;
	onRestore?: () => void;
	onDelete?: () => void;
}) {
	return (
		<div className="mini" style={{ minHeight: 52, cursor: "default", gap: 12 }}>
			{lead}
			<div className="grow" style={{ minWidth: 0 }}>
				<div className="trunc" style={{ fontWeight: 500 }}>
					{title}
				</div>
				<div className="faint trunc" style={{ fontSize: 12 }}>
					{sub}
				</div>
			</div>
			<span
				className="faint hide-m"
				style={{ fontSize: 12, whiteSpace: "nowrap" }}
				suppressHydrationWarning
			>
				{when}
			</span>
			{onRestore && (
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={onRestore}
				>
					<span
						className="icon-[solar--restart-linear] size-[13px]"
						aria-hidden="true"
					/>
					Restore
				</button>
			)}
			{onDelete && (
				<button
					type="button"
					className="ibtn ibtn-sm"
					data-tip="Delete permanently"
					aria-label="Delete permanently"
					style={{ color: "var(--q-red)" }}
					onClick={onDelete}
				>
					<span
						className="icon-[solar--trash-bin-minimalistic-linear] size-[15px]"
						aria-hidden="true"
					/>
				</button>
			)}
		</div>
	);
}

function Empty({ title, body }: { title: string; body: string }) {
	return (
		<div className="panel">
			<div className="empty-state">
				<div className="glyph">
					<span
						className="icon-[solar--archive-linear] size-5"
						aria-hidden="true"
					/>
				</div>
				<h2 className="es-h">{title}</h2>
				<p>{body}</p>
			</div>
		</div>
	);
}
