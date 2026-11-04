import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AuthShell } from "#/components/auth/auth-shell";
import { Button } from "#/components/ui/button";
import { NOINDEX } from "#/lib/seo";
import { getSignInLinkEmail } from "#/lib/session";

// A sign-in link opened from an email app or another site lands here first (lib/auth.ts
// confirmLinkFirst): it says whose account it signs into, so nobody can slip you a link to theirs.
export const Route = createFileRoute("/auth/confirm-sign-in")({
	validateSearch: z.object({
		token: z.string().max(200).catch(""),
		callbackURL: z.string().max(500).optional(),
		newUserCallbackURL: z.string().max(500).optional(),
		errorCallbackURL: z.string().max(500).optional(),
	}),
	loaderDeps: ({ search }) => ({ token: search.token }),
	loader: async ({ deps }) => ({
		email: await getSignInLinkEmail({ data: deps.token }),
	}),
	head: () => ({ meta: [{ title: "Confirm sign-in - Zadaci" }, NOINDEX] }),
	component: ConfirmSignIn,
});

function ConfirmSignIn() {
	const search = Route.useSearch();
	const { email } = Route.useLoaderData();
	if (!email)
		return (
			<AuthShell
				title="This sign-in link has expired"
				description="Links work once and for 10 minutes. Ask for a new one."
			>
				<Button asChild size="lg">
					<Link to="/auth/signin">Back to sign in</Link>
				</Button>
			</AuthShell>
		);
	// continuing from this page is a same-origin request, which the sign-in lets through
	const verify = `/api/auth/magic-link/verify?${new URLSearchParams(
		Object.entries(search).filter((e): e is [string, string] => !!e[1]),
	)}`;
	return (
		<AuthShell
			title="Sign in to Zadaci?"
			description="Check it's your email. If you didn't ask for this link, close this page."
		>
			<p className="rounded-md border px-3 py-2 text-sm">
				You're signing in as <b>{email}</b>
			</p>
			<div className="flex gap-2">
				<Button asChild variant="outline" size="lg" className="flex-1">
					<Link to="/auth/signin">Not me</Link>
				</Button>
				<Button asChild size="lg" className="flex-1">
					<a href={verify}>Continue</a>
				</Button>
			</div>
		</AuthShell>
	);
}
