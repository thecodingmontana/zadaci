import { Link } from "@tanstack/react-router";
import { AuthShell } from "#/components/auth/auth-shell";
import { Button } from "#/components/ui/button";

export function NotFound() {
	return (
		<AuthShell
			title="Page not found"
			description="The page you're looking for doesn't exist or you don't have access to it."
		>
			<Button asChild size="lg" className="h-11">
				<Link to="/">Go home</Link>
			</Button>
		</AuthShell>
	);
}
