import { useMutation, useQuery, useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { InboxSkeleton } from "#/components/shell/page-skeletons";
import {
	CellAssignee,
	CellDue,
	CellPrio,
	CellStatus,
} from "#/components/tasks/cells";
import { TaskViewProvider } from "#/components/tasks/context";
import { Comments } from "#/components/tasks/drawer-conversation";
import { Sk } from "#/components/tasks/skeletons";
import {
	MARK_ALL_NOTIFICATIONS_READ,
	NOTIFICATIONS,
	type NotificationItem,
	SET_NOTIFICATION_READ,
	TASK_DETAIL,
} from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Ported from the reference app's Inbox: notifications on the left, the task's conversation
// on the right so you can read and reply without leaving.

const CATS = [
	["all", "All"],
	["mention", "Mentions"],
	["assign", "Assignments"],
	["comment", "Comments"],
	["update", "Updates"],
] as const;
type Cat = (typeof CATS)[number][0];

const TYPE_ICON: Record<string, string> = {
	mention: "icon-[solar--mention-circle-linear]",
	assign: "icon-[solar--user-plus-linear]",
	comment: "icon-[solar--chat-round-line-linear]",
	update: "icon-[solar--refresh-linear]",
};

export const Route = createFileRoute("/_authed/w/$slug/inbox")({
	validateSearch: z.object({
		cat: z.enum(["all", "mention", "assign", "comment", "update"]).optional(),
		unread: z.boolean().optional(),
		sel: z.string().optional(),
	}),
	shouldReload: reloadOnEnter,
	loader: ({ context, params }) =>
		context.apolloClient.query({
			query: NOTIFICATIONS,
			variables: { slug: params.slug, unread: false },
			fetchPolicy: "network-only",
		}),
	head: () => ({ meta: [{ title: "Inbox - Zadaci" }] }),
	pendingComponent: InboxSkeleton,
	component: InboxPage,
});

const refetch = { refetchQueries: ["Notifications", "NotificationCounts"] };

function InboxPage() {
	const { slug } = Route.useParams();
	const { cat = "all", unread = false, sel } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data } = useSuspenseQuery(NOTIFICATIONS, {
		variables: { slug, unread: false },
	});
	const [markAll] = useMutation(MARK_ALL_NOTIFICATIONS_READ, refetch);
	const [setRead] = useMutation(SET_NOTIFICATION_READ, refetch);
	const all = data.workspace?.notifications ?? [];
	const count = (k: Cat) =>
		all.filter((n) => (k === "all" || n.type === k) && !n.read).length;
	const shown = all.filter(
		(n) => (cat === "all" || n.type === cat) && (!unread || !n.read),
	);
	const selected = all.find((n) => n.id === sel) ?? null;
	const setSearch = (patch: { cat?: Cat; unread?: boolean; sel?: string }) =>
		navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
	const mark = (n: NotificationItem, read: boolean) =>
		setRead({ variables: { slug, id: n.id, read } }).catch((error: Error) =>
			toast.error("Couldn't update the notification", { desc: error.message }),
		);
	const select = (n: NotificationItem) => {
		if (!n.read) mark(n, true);
		setSearch({ sel: n.id });
	};

	return (
		<div className="page flush">
			<div
				className={cn("inbox-grid", selected && "has-sel")}
				style={{
					display: "grid",
					gridTemplateColumns: "minmax(0,420px) minmax(0,1fr)",
					flex: 1,
					minHeight: 0,
				}}
			>
				<div
					style={{
						borderRight: "1px solid var(--q-border)",
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
					}}
				>
					<div style={{ padding: "18px var(--q-gutter) 0" }} className="row">
						<h1
							style={{
								fontSize: "var(--q-fs-xl)",
								margin: 0,
								fontWeight: 600,
								letterSpacing: "-.015em",
							}}
						>
							Inbox
						</h1>
						<span className="sp" />
						<label
							className="row"
							style={{
								fontSize: 12,
								color: "var(--q-text-2)",
								gap: 6,
								cursor: "pointer",
							}}
						>
							<input
								type="checkbox"
								className="toggle"
								checked={unread}
								onChange={(e) =>
									setSearch({ unread: e.target.checked || undefined })
								}
							/>
							Unread
						</label>
						<button
							type="button"
							className="ibtn ibtn-sm"
							data-tip="Mark all as read"
							aria-label="Mark all as read"
							disabled={!count("all")}
							onClick={() =>
								markAll({ variables: { slug } }).catch((error: Error) =>
									toast.error("Couldn't mark them as read", {
										desc: error.message,
									}),
								)
							}
						>
							<span
								className="icon-[solar--check-read-linear] size-[15px]"
								aria-hidden="true"
							/>
						</button>
					</div>
					<div className="tabs inbox-tabs" role="tablist">
						{CATS.map(([k, label]) => (
							<button
								key={k}
								type="button"
								role="tab"
								aria-selected={cat === k}
								className={cn("tab", cat === k && "on")}
								onClick={() => setSearch({ cat: k === "all" ? undefined : k })}
							>
								{label}
								{count(k) > 0 && <span className="cnt">{count(k)}</span>}
							</button>
						))}
					</div>
					<div className="inbox-list">
						{shown.length ? (
							shown.map((n) => (
								<InboxItem
									key={n.id}
									n={n}
									on={selected?.id === n.id}
									onSelect={() => select(n)}
									onToggleRead={() => mark(n, !n.read)}
								/>
							))
						) : (
							<div className="empty-state sm">
								<div className="glyph">
									<span
										className="icon-[solar--inbox-linear] size-5"
										aria-hidden="true"
									/>
								</div>
								<h2 className="es-h">You're all caught up.</h2>
								<p>
									{unread
										? "No unread notifications in this category."
										: "New mentions, assignments, and comments will show up here."}
								</p>
							</div>
						)}
					</div>
				</div>
				<div
					className="inbox-prev"
					style={{
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
						overflowY: "auto",
					}}
				>
					{selected ? (
						<Preview
							slug={slug}
							n={selected}
							onBack={() => setSearch({ sel: undefined })}
						/>
					) : (
						<div className="fullstate">
							<div className="box">
								<div className="empty-state" style={{ padding: 0 }}>
									<div className="glyph">
										<span
											className="icon-[solar--letter-opened-linear] size-5"
											aria-hidden="true"
										/>
									</div>
									<h2 className="es-h">Select a notification</h2>
									<p>
										Read the conversation and reply without leaving your inbox.
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function InboxItem({
	n,
	on,
	onSelect,
	onToggleRead,
}: {
	n: NotificationItem;
	on: boolean;
	onSelect: () => void;
	onToggleRead: () => void;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: the row holds its own read toggle, so it can't be a <button>
		<div
			className="row"
			style={{
				alignItems: "flex-start",
				gap: 10,
				padding: "12px var(--q-gutter)",
				borderBottom: "1px solid var(--q-divider)",
				cursor: "pointer",
				position: "relative",
				background: on ? "var(--q-surface-2)" : undefined,
			}}
			role="button"
			tabIndex={0}
			aria-current={on || undefined}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (
					e.target === e.currentTarget &&
					(e.key === "Enter" || e.key === " ")
				) {
					e.preventDefault();
					onSelect();
				}
			}}
		>
			{!n.read && (
				<span
					style={{
						position: "absolute",
						left: 6,
						top: 22,
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: "var(--q-accent)",
					}}
					role="img"
					aria-label="Unread"
				/>
			)}
			{n.actor ? (
				<Av name={n.actor.name} image={n.actor.image} className="md" />
			) : (
				<span
					className="av md"
					style={
						{
							"--c": n.projectId ? "var(--q-red)" : "var(--q-amber)",
						} as React.CSSProperties
					}
				>
					<span
						className={cn(
							n.type === "update" && n.projectId
								? "icon-[solar--danger-triangle-linear]"
								: "icon-[solar--clock-circle-linear]",
							"size-[13px]",
						)}
						aria-hidden="true"
					/>
				</span>
			)}
			<div className="grow" style={{ fontSize: 13, lineHeight: 1.45 }}>
				<div>
					{n.actor ? (
						<>
							<b style={{ fontWeight: 600 }}>{n.actor.name}</b>{" "}
							<span className="muted">{n.text}</span>{" "}
							{n.taskTitle && <b style={{ fontWeight: 500 }}>{n.taskTitle}</b>}
						</>
					) : n.taskTitle ? (
						<>
							<b style={{ fontWeight: 600 }}>{n.taskTitle}</b>{" "}
							<span className="muted">{n.text}</span>
						</>
					) : (
						<b style={{ fontWeight: 600 }}>{n.text}</b>
					)}
				</div>
				{n.snippet && (
					<div className="trunc muted" style={{ fontSize: 12.5, marginTop: 2 }}>
						{n.snippet}
					</div>
				)}
				<div
					className="row"
					style={{
						gap: 6,
						marginTop: 5,
						fontSize: 11.5,
						color: "var(--q-text-3)",
					}}
				>
					<span
						className={cn(TYPE_ICON[n.type] ?? TYPE_ICON.update, "size-[11px]")}
						aria-hidden="true"
					/>
					{n.projectTitle && (
						<>
							<span
								className="pdot"
								style={
									{
										"--c": projectColor(n.projectColor),
										width: 6,
										height: 6,
									} as React.CSSProperties
								}
							/>
							{n.projectTitle}
						</>
					)}
					<span>·</span>
					<time dateTime={n.createdAt} suppressHydrationWarning>
						{ago(n.createdAt)}
					</time>
				</div>
			</div>
			<button
				type="button"
				className="ibtn ibtn-xs"
				data-tip={n.read ? "Mark as unread" : "Mark as read"}
				aria-label={n.read ? "Mark as unread" : "Mark as read"}
				onClick={(e) => {
					e.stopPropagation();
					onToggleRead();
				}}
			>
				<span
					className={cn(
						n.read
							? "icon-[solar--letter-linear]"
							: "icon-[solar--letter-opened-linear]",
						"size-[13px]",
					)}
					aria-hidden="true"
				/>
			</button>
		</div>
	);
}

/** The selected notification: its task's details and conversation, or the project alert. */
function Preview({
	slug,
	n,
	onBack,
}: {
	slug: string;
	n: NotificationItem;
	onBack: () => void;
}) {
	const navigate = useNavigate();
	const { data, loading } = useQuery(TASK_DETAIL, {
		variables: { slug, id: n.taskId ?? "" },
		skip: !n.taskId,
		fetchPolicy: "cache-and-network",
	});
	const workspace = data?.workspace;
	const t = workspace?.task;

	if (!n.taskId)
		return (
			<div style={{ padding: "24px 28px" }}>
				<button
					type="button"
					className="btn btn-sm btn-ghost"
					style={{ margin: "-4px 0 12px -8px" }}
					onClick={onBack}
				>
					<span
						className="icon-[solar--arrow-left-linear] size-3.5"
						aria-hidden="true"
					/>
					Back
				</button>
				<div className="alert danger">
					<span
						className="i icon-[solar--danger-triangle-linear] size-4"
						aria-hidden="true"
					/>
					<div>
						<b>{n.text}</b>
						{n.snippet && (
							<div className="muted" style={{ marginTop: 2 }}>
								{n.snippet}
							</div>
						)}
					</div>
				</div>
				{n.projectId && (
					<div style={{ marginTop: 14 }}>
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() =>
								navigate({
									to: "/w/$slug/p/$projectId",
									params: { slug, projectId: n.projectId as string },
									search: { tab: "overview" },
								})
							}
						>
							Open project
						</button>
					</div>
				)}
			</div>
		);

	if (!workspace || !t)
		return loading ? (
			// the preview's own layout while the task loads
			<div aria-busy="true">
				<span className="sr">Loading task…</span>
				<div
					className="row"
					style={{
						height: 46,
						padding: "0 16px",
						borderBottom: "1px solid var(--q-border)",
						gap: 8,
					}}
				>
					<Sk w={22} h={22} r={6} />
					<Sk w={120} h={11} />
					<span className="sp" />
					<Sk w={92} h={26} r={6} />
				</div>
				<div style={{ padding: "24px 28px", maxWidth: 720 }}>
					<Sk w="55%" h={22} />
					<div className="row" style={{ gap: 10, margin: "14px 0 22px" }}>
						<Sk w={70} h={18} r={5} />
						<Sk w={96} h={18} r={5} />
						<Sk w={64} h={18} r={5} />
						<Sk w={56} h={18} r={5} />
					</div>
					<div className="eyebrow" style={{ marginBottom: 10 }}>
						Conversation
					</div>
					{[70, 52].map((w) => (
						<div
							key={w}
							className="row"
							style={{ alignItems: "flex-start", gap: 10, marginBottom: 16 }}
						>
							<Sk w={26} h={26} r="50%" />
							<div className="grow col" style={{ gap: 6 }}>
								<Sk w={110} h={10} />
								<Sk w={`${w}%`} h={11} />
							</div>
						</div>
					))}
					<Sk w="100%" h={90} r={10} />
				</div>
			</div>
		) : (
			<div style={{ padding: "24px 28px" }} className="faint">
				This task was deleted or you can't see it.
			</div>
		);

	const project = workspace.projects.find((p) => p.id === t.projectId);
	return (
		<TaskViewProvider
			slug={slug}
			members={workspace.members}
			projects={workspace.projects}
		>
			<div
				className="row"
				style={{
					height: 46,
					padding: "0 16px",
					borderBottom: "1px solid var(--q-border)",
					gap: 8,
					flexShrink: 0,
				}}
			>
				<button
					type="button"
					className="ibtn ibtn-sm"
					aria-label="Back"
					onClick={onBack}
				>
					<span
						className="icon-[solar--arrow-left-linear] size-[15px]"
						aria-hidden="true"
					/>
				</button>
				<span
					className="pdot"
					style={{ "--c": projectColor(project?.color) } as React.CSSProperties}
				/>
				<span className="muted" style={{ fontSize: 12.5 }}>
					{project?.title}
				</span>
				<span className="faint mono">{t.key}</span>
				<span className="sp" />
				<button
					type="button"
					className="btn btn-sm btn-secondary"
					onClick={() =>
						navigate({
							to: ".",
							search: (s: Record<string, unknown>) => ({ ...s, task: t.id }),
						})
					}
				>
					<span
						className="icon-[solar--sidebar-minimalistic-linear] size-3.5"
						aria-hidden="true"
					/>
					Open task
				</button>
			</div>
			<div style={{ padding: "24px 28px", maxWidth: 720, width: "100%" }}>
				<h2
					style={{
						fontSize: "var(--q-fs-xl)",
						margin: "0 0 10px",
						fontWeight: 600,
						letterSpacing: "-.015em",
					}}
				>
					{t.name}
				</h2>
				<div
					className="row"
					style={{ flexWrap: "wrap", gap: 4, marginBottom: 18 }}
				>
					<CellStatus t={t} />
					<CellAssignee t={t} />
					<CellPrio t={t} />
					<CellDue t={t} />
				</div>
				<div className="eyebrow" style={{ marginBottom: 4 }}>
					Conversation
				</div>
				<Comments t={t} />
			</div>
		</TaskViewProvider>
	);
}
