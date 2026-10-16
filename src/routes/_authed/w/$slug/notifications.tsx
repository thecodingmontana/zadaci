import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Av } from "#/components/q/av";
import {
	MARK_ALL_NOTIFICATIONS_READ,
	NOTIFICATIONS,
	type NotificationItem,
	SET_NOTIFICATION_READ,
} from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";
import { ago, byDay } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Ported from the reference app's Notifications page.

export const Route = createFileRoute("/_authed/w/$slug/notifications")({
	validateSearch: z.object({ filter: z.enum(["all", "unread"]).optional() }),
	loaderDeps: ({ search }) => search,
	shouldReload: reloadOnEnter,
	loader: ({ context, params, deps }) =>
		context.apolloClient.query({
			query: NOTIFICATIONS,
			variables: { slug: params.slug, unread: deps.filter === "unread" },
			fetchPolicy: "network-only",
		}),
	head: () => ({ meta: [{ title: "Notifications - Zadaci" }] }),
	component: NotificationsPage,
});

const refetch = { refetchQueries: ["Notifications", "NotificationCounts"] };

function NotificationsPage() {
	const { slug } = Route.useParams();
	const { filter = "all" } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data } = useSuspenseQuery(NOTIFICATIONS, {
		variables: { slug, unread: filter === "unread" },
	});
	const [markAll] = useMutation(MARK_ALL_NOTIFICATIONS_READ, refetch);
	const items = data.workspace?.notifications ?? [];
	const unread = data.workspace?.unreadNotifications ?? 0;
	const setFilter = (f: "all" | "unread") =>
		navigate({
			search: { filter: f === "all" ? undefined : f },
			replace: true,
		});

	return (
		<div className="page" style={{ maxWidth: 820 }}>
			<div className="ph">
				<div>
					<h1 className="row" style={{ gap: 10 }}>
						Notifications
						{unread > 0 && (
							<span className="badge accent">{unread} unread</span>
						)}
					</h1>
					<p>Updates on tasks and projects you follow.</p>
				</div>
				<div className="acts">
					<div className="seg">
						{(
							[
								["all", "All"],
								["unread", "Unread"],
							] as const
						).map(([k, label]) => (
							<button
								key={k}
								type="button"
								className={filter === k ? "on" : ""}
								aria-pressed={filter === k}
								onClick={() => setFilter(k)}
							>
								{label}
							</button>
						))}
					</div>
					<button
						type="button"
						className="btn btn-secondary"
						disabled={!unread}
						onClick={() =>
							markAll({ variables: { slug } })
								.then(() => toast.success("You're all caught up."))
								.catch((error: Error) =>
									toast.error("Couldn't mark them as read", {
										desc: error.message,
									}),
								)
						}
					>
						<span
							className="icon-[solar--check-read-linear] size-3.5"
							aria-hidden="true"
						/>
						Mark all as read
					</button>
					<Link
						to="/w/$slug/settings"
						params={{ slug }}
						search={{ sec: "notif-email" }}
						className="ibtn"
						data-tip="Notification preferences"
						aria-label="Notification preferences"
					>
						<span
							className="icon-[solar--settings-linear] size-4"
							aria-hidden="true"
						/>
					</Link>
				</div>
			</div>
			{items.length ? (
				byDay(items).map(([day, list]) => (
					<div key={day}>
						<div className="day-h">{day}</div>
						<div className="panel" style={{ overflow: "hidden" }}>
							{list.map((n) => (
								<NotificationRow key={n.id} slug={slug} n={n} />
							))}
						</div>
					</div>
				))
			) : (
				<div className="panel">
					<div className="empty-state">
						<div className="glyph">
							<span
								className="icon-[solar--bell-off-linear] size-5"
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">You're all caught up.</h2>
						<p>
							No unread notifications. We'll let you know when something needs
							you.
						</p>
						{filter === "unread" && (
							<button
								type="button"
								className="btn btn-secondary btn-sm"
								onClick={() => setFilter("all")}
							>
								Show all
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

/** Who did what, like the reference's notifText. */
function NotificationText({ n }: { n: NotificationItem }) {
	if (!n.actor)
		return n.taskTitle ? (
			<>
				<b className="font-semibold">{n.taskTitle}</b>{" "}
				<span className="muted">{n.text}</span>
			</>
		) : (
			<b className="font-semibold">{n.text}</b>
		);
	return (
		<>
			<b className="font-semibold">{n.actor.name}</b>{" "}
			<span className="muted">{n.text}</span>{" "}
			{n.taskTitle && <b className="font-medium">{n.taskTitle}</b>}
		</>
	);
}

function NotificationIcon({ n }: { n: NotificationItem }) {
	if (n.actor)
		return <Av name={n.actor.name} image={n.actor.image} className="md" />;
	return (
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
	);
}

function NotificationRow({ slug, n }: { slug: string; n: NotificationItem }) {
	const navigate = useNavigate();
	const [setRead] = useMutation(SET_NOTIFICATION_READ, refetch);
	const mark = (read: boolean) =>
		setRead({ variables: { slug, id: n.id, read } }).catch((error: Error) =>
			toast.error("Couldn't update the notification", { desc: error.message }),
		);
	// shortcut: opens the project; open the task drawer once tasks are built
	const open = () => {
		if (!n.read) mark(true);
		if (n.projectId)
			navigate({
				to: "/w/$slug/p/$projectId",
				params: { slug, projectId: n.projectId },
			});
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: the row holds its own toggle button, so it can't be a <button>
		<div
			className={cn("nrow", !n.read && "unread")}
			role="button"
			tabIndex={0}
			onClick={open}
			onKeyDown={(e) => {
				if (
					e.target === e.currentTarget &&
					(e.key === "Enter" || e.key === " ")
				) {
					e.preventDefault();
					open();
				}
			}}
		>
			<NotificationIcon n={n} />
			<div className="grow" style={{ fontSize: 13 }}>
				<div>
					<NotificationText n={n} />
				</div>
				{n.snippet && (
					<div className="muted trunc" style={{ fontSize: 12.5, marginTop: 2 }}>
						{n.snippet}
					</div>
				)}
				<div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>
					{n.projectTitle && `${n.projectTitle} · `}
					<time dateTime={n.createdAt} suppressHydrationWarning>
						{ago(n.createdAt)}
					</time>
				</div>
			</div>
			{!n.read && (
				<span
					style={{
						width: 7,
						height: 7,
						borderRadius: "50%",
						background: "var(--q-accent)",
						marginTop: 8,
						flexShrink: 0,
					}}
					role="img"
					aria-label="Unread"
				/>
			)}
			<button
				type="button"
				className="ibtn ibtn-sm"
				data-tip={n.read ? "Mark as unread" : "Mark as read"}
				aria-label={n.read ? "Mark as unread" : "Mark as read"}
				onClick={(e) => {
					e.stopPropagation();
					mark(!n.read);
				}}
			>
				<span
					className={cn(
						n.read
							? "icon-[solar--letter-linear]"
							: "icon-[hugeicons--tick-02]",
						"size-3.5",
					)}
					aria-hidden="true"
				/>
			</button>
		</div>
	);
}
