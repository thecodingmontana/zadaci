import { useQuery, useSuspenseQuery } from "@apollo/client/react";
import {
	createFileRoute,
	notFound,
	Outlet,
	useRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import { AppSidebar } from "#/components/shell/app-sidebar";
import { CommandMenuProvider } from "#/components/shell/command-menu";
import { ShellProvider, useShell } from "#/components/shell/shell-state";
import { BottomNav, Topbar } from "#/components/shell/topbar";
import { TaskDrawer } from "#/components/tasks/drawer";
import { NewTaskProvider } from "#/components/tasks/new-task";
import { TooltipProvider } from "#/components/ui/tooltip";
import { NOTIFICATION_COUNTS, SHELL } from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { reloadOnEnter } from "#/lib/routing";
import { getSidebarOpen } from "#/lib/session";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_authed/w/$slug")({
	// ?task=<id> opens the task drawer over any workspace page
	validateSearch: z.object({ task: z.string().optional() }),
	shouldReload: reloadOnEnter,
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
	const { task } = Route.useSearch();
	const router = useRouter();
	const setTask = (id: string | undefined) =>
		router.navigate({
			to: ".",
			search: ((prev: Record<string, unknown>) => ({
				...prev,
				task: id,
			})) as never,
		});
	// One poller for the sidebar, bell and bottom-nav badges; reading marks them refetch it too.
	const counts = useQuery(NOTIFICATION_COUNTS, {
		variables: { slug },
		pollInterval: 60_000,
	}).data?.workspace;
	const unread = {
		all: counts?.unreadNotifications ?? 0,
		inbox: counts?.unreadInbox ?? 0,
	};
	const workspace = data.workspace;
	if (!workspace) return null;

	return (
		<TooltipProvider delayDuration={200}>
			<NewTaskProvider slug={slug} onCreated={(id) => setTask(id)}>
				<CommandMenuProvider
					slug={slug}
					workspaces={data.workspaces}
					projects={workspace.projects}
				>
					<a href="#main-content" className="skip">
						Skip to content
					</a>
					<div
						className={cn(
							"shell h-dvh",
							collapsed && "collapsed",
							mnav && "mnav",
						)}
					>
						<AppSidebar
							workspace={workspace}
							workspaces={data.workspaces}
							projects={workspace.projects}
							teams={workspace.teams}
							user={user}
							unread={unread}
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
								unread={unread.all}
								canCreateProjects={can(
									workspace.role,
									"createProjects",
									workspace.settings,
								)}
							/>
							<div className="content" id="main-content" tabIndex={-1}>
								<Outlet />
							</div>
							{task && (
								<TaskDrawer
									key={task}
									slug={slug}
									taskId={task}
									onClose={() => setTask(undefined)}
									onOpen={(id) => setTask(id)}
								/>
							)}
						</main>
						<BottomNav slug={slug} unread={unread.inbox} />
					</div>
				</CommandMenuProvider>
			</NewTaskProvider>
		</TooltipProvider>
	);
}
