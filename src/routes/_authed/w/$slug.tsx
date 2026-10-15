import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "#/components/shell/app-sidebar";
import { CommandMenuProvider } from "#/components/shell/command-menu";
import { ShellProvider, useShell } from "#/components/shell/shell-state";
import { BottomNav, Topbar } from "#/components/shell/topbar";
import { SHELL } from "#/graphql/operations";
import { getSidebarOpen } from "#/lib/session";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_authed/w/$slug")({
	loader: async ({ context, params }) => {
		const [{ data }, sidebarOpen] = await Promise.all([
			context.apolloClient.query({
				query: SHELL,
				variables: { slug: params.slug },
			}),
			getSidebarOpen(),
		]);
		if (!data?.workspace) throw notFound();
		return { sidebarOpen };
	},
	head: ({ params }) => ({ meta: [{ title: `${params.slug} - Zadaci` }] }),
	component: WorkspaceShell,
});

function WorkspaceShell() {
	const { sidebarOpen } = Route.useLoaderData();
	return (
		<ShellProvider defaultCollapsed={!sidebarOpen}>
			<ShellLayout />
		</ShellProvider>
	);
}

// Layout ported from the reference app's renderShell (shell.js).
function ShellLayout() {
	const { slug } = Route.useParams();
	const { user } = Route.useRouteContext();
	const { collapsed, mnav, setMnav } = useShell();
	const { data } = useSuspenseQuery(SHELL, { variables: { slug } });
	const workspace = data.workspace;
	if (!workspace) return null;

	return (
		<CommandMenuProvider
			slug={slug}
			workspaces={data.workspaces}
			projects={workspace.projects}
		>
			<a href="#main-content" className="skip">
				Skip to content
			</a>
			<div
				className={cn("shell h-dvh", collapsed && "collapsed", mnav && "mnav")}
			>
				<AppSidebar
					workspace={workspace}
					workspaces={data.workspaces}
					projects={workspace.projects}
					teams={workspace.teams}
					user={user}
				/>
				{mnav && (
					<div
						className="side-scrim"
						onClick={() => setMnav(false)}
						aria-hidden="true"
					/>
				)}
				<main className="main" id="main">
					<Topbar
						slug={slug}
						projects={workspace.projects}
						teams={workspace.teams}
						user={user}
					/>
					<div className="content" id="main-content" tabIndex={-1}>
						<Outlet />
					</div>
				</main>
				<BottomNav slug={slug} />
			</div>
		</CommandMenuProvider>
	);
}
