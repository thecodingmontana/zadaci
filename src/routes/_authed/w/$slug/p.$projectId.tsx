import { useMutation, useQuery, useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ActivityItem } from "#/components/activity/activity-item";
import { PIcon, projectColor, StatusMenu } from "#/components/projects/bits";
import { ProjectOverview } from "#/components/projects/overview";
import { ProjectModal } from "#/components/projects/project-modal";
import {
	SavedViewTab,
	SaveViewButton,
} from "#/components/projects/saved-views";
import { ShareModal } from "#/components/projects/share-modal";
import { AvStack } from "#/components/q/av";
import { PROJECT_PAGE_TABS } from "#/components/shell/nav";
import { ProjectPageSkeleton } from "#/components/shell/page-skeletons";
import { ProjectMenu } from "#/components/shell/project-menu";
import { FilesView } from "#/components/tasks/files-view";
import { ProjectTasks } from "#/components/tasks/project-tasks";
import {
	ACTIVITY,
	PROJECT_PAGE,
	TOGGLE_FAVORITE,
	UPDATE_PROJECT,
} from "#/graphql/operations";
import { can, hasRight } from "#/lib/permissions";
import { pstat } from "#/lib/projects";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";
import { byDay } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Ported from the reference app's project page (pages/project.js): header and view tabs.

const TABS = PROJECT_PAGE_TABS.map((t) => t.tab);

export const Route = createFileRoute("/_authed/w/$slug/p/$projectId")({
	validateSearch: z.object({
		// a built-in view, or "v:<id>" for a saved view
		tab: z
			.string()
			.refine((t) => TABS.includes(t as never) || t.startsWith("v:"))
			.optional(),
	}),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const { slug, projectId } = params;
		const [{ data }] = await Promise.all([
			context.apolloClient.query({
				query: PROJECT_PAGE,
				variables: { slug, projectId },
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({
				query: ACTIVITY,
				variables: { slug, filter: "all", projectId },
				fetchPolicy: "network-only",
			}),
		]);
		if (!data?.workspace) throw notFound();
		return { title: data.workspace.project?.title ?? null };
	},
	head: ({ loaderData, matches }) => ({
		meta: [{ title: wsTitle(matches, loaderData?.title ?? "Project") }],
	}),
	pendingComponent: ProjectPageSkeleton,
	component: ProjectPage,
});

function ProjectPage() {
	const { slug, projectId } = Route.useParams();
	const { tab = "board" } = Route.useSearch();
	const { user } = Route.useRouteContext();
	const { data } = useSuspenseQuery(PROJECT_PAGE, {
		variables: { slug, projectId },
	});
	const { data: feed } = useQuery(ACTIVITY, {
		variables: { slug, filter: "all", projectId },
	});
	const [editing, setEditing] = useState(false);
	const [sharing, setSharing] = useState(false);
	const refetch = {
		refetchQueries: ["ProjectPage", "Shell", "Projects", "Activity"],
	};
	const [toggleFavorite] = useMutation(TOGGLE_FAVORITE, refetch);
	const [update] = useMutation(UPDATE_PROJECT, refetch);
	const workspace = data.workspace;
	const project = workspace?.project;
	if (!workspace || !project) return <NoAccess slug={slug} />;

	const canEdit = hasRight(project.myAccess, "edit");
	const stats = workspace.projectStats.find((s) => s.projectId === project.id);
	const savedView = project.savedViews.find((v) => tab === `v:${v.id}`);
	const activity = feed?.workspace?.activity ?? [];

	return (
		<div className="page flush">
			<div className="proj-h">
				<div className="t">
					<PIcon icon={project.icon} color={project.color} size="lg" px={18} />
					<h1>{project.title}</h1>
					<button
						type="button"
						className="ibtn ibtn-sm"
						data-tip={
							project.isFavorite ? "Remove from favorites" : "Add to favorites"
						}
						aria-pressed={project.isFavorite}
						aria-label="Favorite"
						style={project.isFavorite ? { color: "var(--q-amber)" } : undefined}
						onClick={() =>
							toggleFavorite({
								variables: { slug, projectId: project.id },
							}).catch((error: Error) =>
								toast.error("Couldn't update favorites", {
									desc: error.message,
								}),
							)
						}
					>
						<span
							className={cn(
								project.isFavorite
									? "icon-[solar--star-bold]"
									: "icon-[solar--star-linear]",
								"size-[15px]",
							)}
							aria-hidden="true"
						/>
					</button>
					<StatusMenu
						status={project.status}
						disabled={!canEdit}
						className="pillbtn bordered h-6"
						onPick={(status) =>
							update({
								variables: { slug, projectId: project.id, input: { status } },
							})
								.then(() =>
									toast.success(
										`${project.title} marked ${pstat(status).name}`,
									),
								)
								.catch((error: Error) =>
									toast.error("Couldn't change the status", {
										desc: error.message,
									}),
								)
						}
					>
						{/* one pill: dot, name, chevron (reference project header) */}
						<span
							className="pdot"
							style={
								{
									"--c": pstat(project.status).c,
									borderRadius: "50%",
									width: 7,
									height: 7,
								} as React.CSSProperties
							}
						/>
						{pstat(project.status).name}
						{canEdit && (
							<span
								className="icon-[solar--alt-arrow-down-linear] size-3"
								aria-hidden="true"
							/>
						)}
					</StatusMenu>
					<span className="sp" />
					<div className="row" style={{ gap: 4 }}>
						<button
							type="button"
							className="row"
							style={{ gap: 0 }}
							aria-label="Members"
							onClick={() => setSharing(true)}
						>
							<AvStack
								people={project.members.map((m) => ({
									id: m.memberId,
									name: m.name,
									image: m.image,
								}))}
								max={5}
								size="md"
							/>
						</button>
						<button
							type="button"
							className="ibtn ibtn-sm"
							data-tip="Add member"
							aria-label="Add member"
							onClick={() => setSharing(true)}
						>
							<span
								className="icon-[solar--user-plus-linear] size-[15px]"
								aria-hidden="true"
							/>
						</button>
						<button
							type="button"
							className="btn btn-secondary btn-sm hide-m"
							onClick={() => setSharing(true)}
						>
							<span
								className="icon-[solar--share-linear] size-[13px]"
								aria-hidden="true"
							/>
							Share
						</button>
						{canEdit && (
							<button
								type="button"
								className="ibtn ibtn-sm"
								data-tip="Project settings"
								aria-label="Project settings"
								onClick={() => setEditing(true)}
							>
								<span
									className="icon-[solar--settings-linear] size-[15px]"
									aria-hidden="true"
								/>
							</button>
						)}
						<ProjectMenu
							slug={slug}
							project={project}
							index={0}
							count={1}
							allowed={(p) => can(workspace.role, p)}
						/>
					</div>
				</div>
				<nav className="tabs" aria-label="Project views">
					{PROJECT_PAGE_TABS.map((t) => (
						<Link
							key={t.tab}
							to="/w/$slug/p/$projectId"
							params={{ slug, projectId }}
							search={{ tab: t.tab }}
							className={cn("tab", tab === t.tab && "on")}
							aria-current={tab === t.tab ? "page" : undefined}
						>
							<span className={cn(t.icon, "size-3.5")} aria-hidden="true" />
							{t.label}
						</Link>
					))}
					{project.savedViews.map((v) => (
						<SavedViewTab
							key={v.id}
							slug={slug}
							projectId={projectId}
							view={v}
							on={tab === `v:${v.id}`}
							editable={canEdit}
						/>
					))}
					{canEdit && <SaveViewButton slug={slug} projectId={projectId} />}
				</nav>
			</div>
			<div className="pbody">
				{tab === "overview" ? (
					<ProjectOverview
						slug={slug}
						project={project}
						stats={stats}
						members={workspace.members}
						teams={workspace.teams}
						activity={activity}
						meId={user.id}
						onEdit={() => setEditing(true)}
						onShare={() => setSharing(true)}
					/>
				) : tab === "activity" ? (
					<div className="page" style={{ maxWidth: 780, paddingTop: 18 }}>
						{activity.length ? (
							byDay(activity).map(([day, list]) => (
								<div key={day}>
									<div className="day-h">{day}</div>
									<div className="feed lined">
										{list.map((a) => (
											<ActivityItem
												key={a.id}
												slug={slug}
												a={a}
												meId={user.id}
											/>
										))}
									</div>
								</div>
							))
						) : (
							<div className="empty-state">
								<div className="glyph">
									<span
										className="icon-[hugeicons--activity-01] size-5"
										aria-hidden="true"
									/>
								</div>
								<h2 className="es-h">No activity yet</h2>
								<p>Changes to this project will appear here.</p>
							</div>
						)}
					</div>
				) : tab === "list" ||
					tab === "board" ||
					tab === "table" ||
					tab === "calendar" ||
					tab === "timeline" ? (
					<ProjectTasks
						slug={slug}
						projectId={project.id}
						type={tab}
						milestones={project.milestones}
						color={projectColor(project.color)}
					/>
				) : tab.startsWith("v:") ? (
					savedView ? (
						<ProjectTasks
							key={savedView.id}
							slug={slug}
							projectId={project.id}
							type={savedView.type}
							milestones={project.milestones}
							color={projectColor(project.color)}
							savedView={savedView}
						/>
					) : (
						<div className="empty-state">
							<div className="glyph">
								<span
									className="icon-[hugeicons--filter] size-5"
									aria-hidden="true"
								/>
							</div>
							<h2 className="es-h">This view was deleted</h2>
							<p>Pick another tab to keep going.</p>
						</div>
					)
				) : tab === "files" ? (
					<FilesView
						slug={slug}
						projectId={project.id}
						members={workspace.members}
					/>
				) : null}
			</div>
			{canEdit && (
				<ProjectModal
					open={editing}
					onOpenChange={setEditing}
					slug={slug}
					project={project}
					members={workspace.members}
					teams={workspace.teams}
				/>
			)}
			<ShareModal
				open={sharing}
				onOpenChange={setSharing}
				slug={slug}
				projectId={project.id}
			/>
		</div>
	);
}

/** Private or missing project (reference stateDenied). */
function NoAccess({ slug }: { slug: string }) {
	return (
		<div className="fullstate">
			<div className="box">
				<div className="empty-state" style={{ padding: 0 }}>
					<div className="glyph">
						<span
							className="icon-[solar--lock-keyhole-linear] size-5"
							aria-hidden="true"
						/>
					</div>
				</div>
				<span className="code">ERROR 403</span>
				<h1>You don't have access</h1>
				<p>
					This project doesn't exist or is private. Ask the project lead to add
					you.
				</p>
				<div className="row">
					<Link to="/w/$slug" params={{ slug }} className="btn btn-secondary">
						Go to Home
					</Link>
				</div>
			</div>
		</div>
	);
}
