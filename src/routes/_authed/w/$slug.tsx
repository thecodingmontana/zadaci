import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "#/components/shell/app-sidebar";
import { CommandMenuProvider } from "#/components/shell/command-menu";
import { BottomNav, Topbar } from "#/components/shell/topbar";
import { SidebarInset, SidebarProvider } from "#/components/ui/sidebar";
import { SHELL } from "#/graphql/operations";
import { getSidebarOpen } from "#/lib/session";

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
	const { slug } = Route.useParams();
	const { user } = Route.useRouteContext();
	const { sidebarOpen } = Route.useLoaderData();
	const { data } = useSuspenseQuery(SHELL, { variables: { slug } });
	const workspace = data.workspace;
	if (!workspace) return null;

	return (
		<SidebarProvider defaultOpen={sidebarOpen}>
			<CommandMenuProvider
				slug={slug}
				workspaces={data.workspaces}
				projects={workspace.projects}
			>
				<a
					href="#main-content"
					className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
				>
					Skip to content
				</a>
				<AppSidebar
					workspace={workspace}
					workspaces={data.workspaces}
					projects={workspace.projects}
					teams={workspace.teams}
					user={user}
				/>
				<SidebarInset>
					<Topbar
						slug={slug}
						projects={workspace.projects}
						teams={workspace.teams}
						user={user}
					/>
					<div
						id="main-content"
						tabIndex={-1}
						className="flex flex-1 flex-col outline-none max-md:pb-14"
					>
						<Outlet />
					</div>
				</SidebarInset>
				<BottomNav slug={slug} />
			</CommandMenuProvider>
		</SidebarProvider>
	);
}
