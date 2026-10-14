import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";
import { takeNext } from "#/lib/next-path";
import { toast } from "#/lib/toast";

// Closing the browser's passkey prompt isn't an error worth a toast.
const CANCELLED = new Set(["AUTH_CANCELLED", "ERROR_CEREMONY_ABORTED"]);

function Spinner() {
	return (
		<span
			className="icon-[hugeicons--loading-03] size-4 animate-spin"
			aria-hidden="true"
		/>
	);
}

export function PasskeySignInButton({
	label = "Sign in with a passkey",
}: {
	label?: string;
}) {
	const navigate = useNavigate();
	const [busy, setBusy] = useState(false);

	return (
		<Button
			variant="outline"
			size="lg"
			className="w-full"
			disabled={busy}
			aria-busy={busy}
			onClick={async () => {
				setBusy(true);
				const { error } = await authClient.signIn.passkey();
				if (!error) return navigate({ href: takeNext() });
				setBusy(false);
				if (!("code" in error && CANCELLED.has(error.code)))
					toast.error("Passkey sign-in failed", { desc: error.message });
			}}
		>
			{busy ? (
				<Spinner />
			) : (
				<span
					className="icon-[solar--key-minimalistic-bold] size-4"
					aria-hidden="true"
				/>
			)}
			{label}
		</Button>
	);
}

export function AddPasskeyButton({
	onAdded,
	className,
	size,
	label = "Add a passkey",
}: {
	onAdded?: () => void;
	className?: string;
	size?: "default" | "lg";
	label?: string;
}) {
	const [busy, setBusy] = useState(false);

	return (
		<Button
			variant="outline"
			size={size}
			className={className}
			disabled={busy}
			aria-busy={busy}
			onClick={async () => {
				setBusy(true);
				const { error } = await authClient.passkey.addPasskey();
				setBusy(false);
				if (!error) {
					toast.success("Passkey added", {
						desc: "Next time, sign in with your passkey.",
					});
					return onAdded?.();
				}
				if (!("code" in error && CANCELLED.has(error.code)))
					toast.error("Couldn't add a passkey", { desc: error.message });
			}}
		>
			{busy ? (
				<Spinner />
			) : (
				<span
					className="icon-[solar--key-minimalistic-bold] size-4"
					aria-hidden="true"
				/>
			)}
			{label}
		</Button>
	);
}
