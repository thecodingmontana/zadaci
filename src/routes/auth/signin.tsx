import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AuthShell } from "#/components/auth/auth-shell";
import { PasskeySignInButton } from "#/components/auth/passkey-buttons";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";
import { rememberNext, safePath } from "#/lib/next-path";
import { NOINDEX } from "#/lib/seo";
import { getSession } from "#/lib/session";
import { toast } from "#/lib/toast";

export const Route = createFileRoute("/auth/signin")({
	validateSearch: z.object({
		error: z.string().optional(),
		redirect: z.string().optional(),
	}),
	beforeLoad: async () => {
		const session = await getSession();
		if (session) throw redirect({ to: "/workspace" });
	},
	head: () => ({ meta: [{ title: "Sign in - Zadaci" }, NOINDEX] }),
	component: SignIn,
});

const ERROR_MESSAGES: Record<string, string> = {
	access_denied: "Google sign-in was cancelled.",
	"2fa_expired": "Your verification window expired. Sign in again.",
};

function SignIn() {
	const { error, redirect: next } = Route.useSearch();
	const [isRedirecting, setIsRedirecting] = useState(false);

	useEffect(() => rememberNext(next), [next]);

	useEffect(() => {
		if (error)
			toast.error(
				ERROR_MESSAGES[error] ?? "We couldn't sign you in. Try again.",
			);
	}, [error]);

	async function signInWithGoogle() {
		setIsRedirecting(true);
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: safePath(next) ?? "/workspace",
			errorCallbackURL: "/auth/signin",
		});
		if (error) {
			setIsRedirecting(false);
			toast.error(error.message ?? "We couldn't reach Google. Try again.");
		}
	}

	return (
		<AuthShell
			title="Welcome to Zadaci"
			description="Sign in with your Google account to continue."
		>
			<Button
				variant="outline"
				size="lg"
				className="w-full"
				disabled={isRedirecting}
				aria-busy={isRedirecting}
				onClick={signInWithGoogle}
			>
				{isRedirecting ? (
					<span
						className="icon-[hugeicons--loading-03] size-4 animate-spin"
						aria-hidden="true"
					/>
				) : (
					<span className="icon-[devicon--google] size-4" aria-hidden="true" />
				)}
				Continue with Google
			</Button>
			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<hr className="grow" />
				or
				<hr className="grow" />
			</div>
			<PasskeySignInButton />
			<p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
				<span
					className="icon-[solar--shield-keyhole-bold] size-4 shrink-0"
					aria-hidden="true"
				/>
				Add an authenticator app or passkey in Settings for extra security.
			</p>
			<p className="text-center text-xs text-muted-foreground">
				By continuing, you agree to our{" "}
				<Link
					to="/terms"
					className="underline underline-offset-2 hover:text-foreground"
				>
					Terms of Service
				</Link>{" "}
				and{" "}
				<Link
					to="/privacy"
					className="underline underline-offset-2 hover:text-foreground"
				>
					Privacy Policy
				</Link>
				.
			</p>
			<p className="text-center text-sm text-muted-foreground">
				New here?{" "}
				<span className="text-foreground">
					Continue with Google above — your account is created automatically,
					then we'll set up your workspace.
				</span>
			</p>
		</AuthShell>
	);
}
