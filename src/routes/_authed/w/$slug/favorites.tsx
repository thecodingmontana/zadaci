import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ProjectCard } from "#/components/projects/project-card";
import { FavoritesSkeleton } from "#/components/shell/page-skeletons";
import { ProjectMenu } from "#/components/shell/project-menu";
import { TaskViewProvider } from "#/components/tasks/context";
import { MiniRow } from "#/components/tasks/mini-row";
import { PROJECTS, TASKS } from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { reloadOnEnter } from "#/lib/routing";

// Ported from the reference app's Favorites page: starred projects, then starred tasks.

export const Route = createFileRoute("/_authed/w/$slug/favorites")({
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const variables = { slug: params.slug };
		const [{ data }] = await Promise.all([
			context.apolloClient.query({
				query: PROJECTS,
				variables,
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({
				query: TASKS,
				variables,
				fetchPolicy: "network-only",
			}),
		]);
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Favorites - Zadaci" }] }),
	pendingComponent: FavoritesSkeleton,
	component: FavoritesPage,
});

function FavoritesPage() {
	const { slug } = Route.useParams();
	const pj = useSuspenseQuery(PROJECTS, { variables: { slug } }).data.workspace;
	const tk = useSuspenseQuery(TASKS, { variables: { slug } }).data.workspace;
	if (!pj || !tk) return null;
	const ps = pj.projects.filter((p) => p.isFavorite);
	const ts = tk.tasks.filter((t) => t.isFavorite);

	return (
		<div className="page wide">
			<div className="ph">
				<div>
					<h1>Favorites</h1>
					<p>Projects and tasks you've starred for quick access.</p>
				</div>
			</div>
			{!ps.length && !ts.length ? (
				<div className="panel">
					<div className="empty-state">
						<div className="glyph">
							<span
								className="icon-[solar--star-linear] size-5"
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">No favorites yet</h2>
						<p>Star a project or task to pin it here.</p>
						<Link
							to="/w/$slug/projects"
							params={{ slug }}
							className="btn btn-secondary btn-sm"
						>
							Browse projects
						</Link>
					</div>
				</div>
			) : (
				<>
					<h2 className="sec" style={{ marginBottom: 10 }}>
						Projects{" "}
						<span className="faint" style={{ fontWeight: 500 }}>
							{ps.length}
						</span>
					</h2>
					{ps.length ? (
						<div className="pgrid" style={{ marginBottom: 28 }}>
							{ps.map((p) => {
								const s = pj.projectStats.find((x) => x.projectId === p.id);
								return (
									<ProjectCard
										key={p.id}
										slug={slug}
										p={p}
										s={s}
										people={(s?.memberIds ?? []).flatMap((id) =>
											pj.members.filter((m) => m.id === id),
										)}
										menu={
											// biome-ignore lint/a11y/noStaticElementInteractions: keeps the menu click from opening the project
											// biome-ignore lint/a11y/useKeyWithClickEvents: only stops propagation; the trigger handles keys
											<span onClick={(e) => e.stopPropagation()}>
												<ProjectMenu
													slug={slug}
													project={p}
													index={0}
													count={1}
													allowed={(perm) => can(pj.role, perm, pj.settings)}
													className="ibtn ibtn-sm more"
												/>
											</span>
										}
									/>
								);
							})}
						</div>
					) : (
						<p className="faint" style={{ marginBottom: 28 }}>
							No favorite projects.
						</p>
					)}
					<h2 className="sec" style={{ marginBottom: 6 }}>
						Tasks{" "}
						<span className="faint" style={{ fontWeight: 500 }}>
							{ts.length}
						</span>
					</h2>
					{ts.length ? (
						<TaskViewProvider
							slug={slug}
							members={tk.members}
							projects={tk.projects}
						>
							<div className="panel" style={{ overflow: "hidden" }}>
								{ts.map((t) => (
									<MiniRow key={t.id} t={t} />
								))}
							</div>
						</TaskViewProvider>
					) : (
						<p className="faint">
							Open a task and click the star to add it here.
						</p>
					)}
				</>
			)}
		</div>
	);
}
