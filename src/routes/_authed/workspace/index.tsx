import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";

// shortcut: placeholder landing until the workspace onboarding (phase 5) replaces it
export const Route = createFileRoute("/_authed/workspace/")({
	component: Workspace,
});

function Workspace() {
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();
	return (
		<main className="grid min-h-dvh place-items-center p-6">
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-lg">Signed in as {user.email}</p>
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
			</div>
		</main>
	);
}
