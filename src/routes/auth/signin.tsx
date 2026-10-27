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
	INVALID_TOKEN:
		"That sign-in link isn't valid or was already used. Ask for a new one.",
	EXPIRED_TOKEN: "That sign-in link expired. Ask for a new one.",
	new_user_signup_disabled: "We couldn't create an account for that email.",
};

function SignIn() {
	const { error, redirect: next } = Route.useSearch();
	const [isRedirecting, setIsRedirecting] = useState(false);
	// "Continue with email" swaps the buttons for the email step
	const [withEmail, setWithEmail] = useState(false);

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
			description="Sign in with Google, an email link or a passkey."
		>
			{withEmail ? (
				<MagicLinkForm
					next={safePath(next) ?? "/workspace"}
					onBack={() => setWithEmail(false)}
				/>
			) : (
				<div className="flex flex-col gap-2">
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
							<span
								className="icon-[devicon--google] size-4"
								aria-hidden="true"
							/>
						)}
						Continue with Google
					</Button>
					<Button
						variant="outline"
						size="lg"
						className="w-full"
						onClick={() => setWithEmail(true)}
					>
						<span
							className="icon-[solar--letter-linear] size-4"
							aria-hidden="true"
						/>
						Continue with email
					</Button>
					<PasskeySignInButton />
				</div>
			)}
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
					Continue with Google or an email link above — your account is created
					automatically, then we'll set up your workspace.
				</span>
			</p>
		</AuthShell>
	);
}

/** "Email me a sign-in link": a one-time link to the inbox, for people who don't use Google. */
function MagicLinkForm({ next, onBack }: { next: string; onBack: () => void }) {
	const [email, setEmail] = useState("");
	const [sending, setSending] = useState(false);
	const [sentTo, setSentTo] = useState<string | null>(null);

	async function send(e: React.FormEvent) {
		e.preventDefault();
		const address = email.trim();
		if (!address) return;
		setSending(true);
		const { error } = await authClient.signIn.magicLink({
			email: address,
			callbackURL: next,
			newUserCallbackURL: next,
			errorCallbackURL: "/auth/signin",
		});
		setSending(false);
		if (error)
			return toast.error(
				error.status === 429
					? "Too many tries. Wait a minute and try again."
					: (error.message ?? "We couldn't send the link. Try again."),
			);
		setSentTo(address);
	}

	if (sentTo)
		return (
			// biome-ignore lint/a11y/useSemanticElements: <output> may only hold inline content; this box has paragraphs and buttons
			<div className="rounded-lg border p-4 text-center text-sm" role="status">
				<span
					className="icon-[solar--letter-opened-linear] mx-auto mb-2 block size-6 text-primary"
					aria-hidden="true"
				/>
				<p className="font-medium">Check your email</p>
				<p className="mt-1 text-muted-foreground">
					We sent a sign-in link to <b className="text-foreground">{sentTo}</b>.
					It works once and expires in 10 minutes.
				</p>
				<div className="mt-3 flex justify-center gap-4 text-xs">
					<button
						type="button"
						className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
						onClick={() => setSentTo(null)}
					>
						Use a different email
					</button>
					<button
						type="button"
						className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
						onClick={onBack}
					>
						Other ways to sign in
					</button>
				</div>
			</div>
		);

	return (
		<form className="flex flex-col gap-2" onSubmit={send}>
			<label htmlFor="magic-email" className="text-sm font-medium">
				Email
			</label>
			<input
				id="magic-email"
				// biome-ignore lint/a11y/noAutofocus: shown only after choosing "Continue with email"
				autoFocus
				type="email"
				required
				autoComplete="email"
				placeholder="you@company.com"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
			/>
			<Button
				type="submit"
				variant="default"
				size="lg"
				className="w-full"
				disabled={sending}
				aria-busy={sending}
			>
				<span
					className={
						sending
							? "icon-[hugeicons--loading-03] size-4 animate-spin"
							: "icon-[solar--letter-linear] size-4"
					}
					aria-hidden="true"
				/>
				Send sign-in link
			</Button>
			<p className="text-center text-xs text-muted-foreground">
				We'll email you a link that signs you in. No password needed.
			</p>
			<button
				type="button"
				className="mt-1 inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				onClick={onBack}
			>
				<span
					className="icon-[solar--arrow-left-linear] size-3.5"
					aria-hidden="true"
				/>
				Other ways to sign in
			</button>
		</form>
	);
}
