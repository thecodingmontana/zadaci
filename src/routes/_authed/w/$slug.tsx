import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { WORKSPACE } from "#/graphql/operations";
import { authClient } from "#/lib/auth-client";
import { toast } from "#/lib/toast";

// shortcut: placeholder workspace page; the real shell (sidebar, board/list views) replaces it next
export const Route = createFileRoute("/_authed/w/$slug")({
	loader: async ({ context, params }) => {
		const { data } = await context.apolloClient.query({
			query: WORKSPACE,
			variables: { slug: params.slug },
		});
		if (!data?.workspace) throw notFound();
	},
	component: WorkspaceHome,
});

function WorkspaceHome() {
	const { slug } = Route.useParams();
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(WORKSPACE, { variables: { slug } });
	const workspace = data.workspace;
	if (!workspace) return null;

	return (
		<main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
			<header className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">{workspace.name}</h1>
					<p className="text-sm text-muted-foreground">
						Signed in as {user.email}
					</p>
				</div>
				<Button
					variant="outline"
					onClick={async () => {
						await authClient.signOut();
						navigate({ to: "/auth/signin" });
					}}
				>
					<span
						className="icon-[solar--logout-2-linear] size-4"
						aria-hidden="true"
					/>
					Sign out
				</Button>
			</header>
			<Button
				variant="outline"
				className="self-start"
				onClick={async () => {
					await navigator.clipboard.writeText(
						`${location.origin}/join/${workspace.inviteCode}`,
					);
					toast.success("Invite link copied");
				}}
			>
				<span className="icon-[solar--link-bold] size-4" aria-hidden="true" />
				Copy invite link
			</Button>
			{workspace.projects.map((project) => (
				<section key={project.id} className="rounded-lg border p-4">
					<h2 className="flex items-center gap-2 font-medium">
						{project.icon && (
							<span
								className={`${project.icon} size-4 text-brand`}
								aria-hidden="true"
							/>
						)}
						{project.title}
					</h2>
					<ul className="mt-3 space-y-1.5 text-sm">
						{project.tasks.map((task) => (
							<li key={task.id} className="flex items-center gap-2">
								<span
									className="size-3.5 rounded-full border"
									aria-hidden="true"
								/>
								{task.name}
							</li>
						))}
					</ul>
				</section>
			))}
		</main>
	);
}
