import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthShell } from "#/components/auth/auth-shell";
import { TotpInput } from "#/components/auth/totp-input";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";
import { takeNext } from "#/lib/next-path";
import { getSession } from "#/lib/session";
import { toast } from "#/lib/toast";

export const Route = createFileRoute("/auth/two-factor/")({
	beforeLoad: async () => {
		if (await getSession()) throw redirect({ to: "/workspace" });
	},
	head: () => ({ meta: [{ title: "Two-step verification - Zadaci" }] }),
	component: VerifyTwoFactor,
});

function VerifyTwoFactor() {
	const navigate = useNavigate();
	const [mode, setMode] = useState<"totp" | "backup">("totp");
	const [code, setCode] = useState("");
	const [trustDevice, setTrustDevice] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);

	async function verify(value: string) {
		setIsVerifying(true);
		const { error } =
			mode === "totp"
				? await authClient.twoFactor.verifyTotp({ code: value, trustDevice })
				: await authClient.twoFactor.verifyBackupCode({
						code: value.trim(),
						trustDevice,
					});
		if (!error) return navigate({ href: takeNext() });

		setIsVerifying(false);
		setCode("");
		if (error.code === "INVALID_TWO_FACTOR_COOKIE") {
			return navigate({ to: "/auth/signin", search: { error: "2fa_expired" } });
		}
		toast.error(
			error.code === "INVALID_CODE" || error.code === "INVALID_BACKUP_CODE"
				? "That code didn't work. Check it and try again."
				: (error.message ?? "Verification failed. Try again."),
		);
	}

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		if (code) void verify(code);
	}

	return (
		<AuthShell
			title="Two-step verification"
			description={
				mode === "totp"
					? "Enter the 6-digit code from your authenticator app."
					: "Enter one of the backup codes you saved when you set up two-step verification."
			}
		>
			<form className="flex flex-col gap-4" onSubmit={onSubmit}>
				{mode === "totp" ? (
					<TotpInput
						value={code}
						onChange={setCode}
						onComplete={verify}
						disabled={isVerifying}
					/>
				) : (
					<input
						// biome-ignore lint/a11y/noAutofocus: the code field is the only task on this page
						autoFocus
						aria-label="Backup code"
						autoComplete="one-time-code"
						spellCheck={false}
						value={code}
						onChange={(e) => setCode(e.target.value)}
						disabled={isVerifying}
						placeholder="xxxxx-xxxxx"
						className="h-11 rounded-md border bg-transparent px-3 text-center font-ibm-plex-mono text-base tracking-wider outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					/>
				)}
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={trustDevice}
						onChange={(e) => setTrustDevice(e.target.checked)}
						className="size-4 accent-brand"
					/>
					Trust this device for 30 days
				</label>
				<Button
					type="submit"
					size="lg"
					className="h-11 bg-brand text-white hover:bg-brand-secondary"
					disabled={!code || isVerifying}
				>
					{isVerifying && (
						<span
							className="icon-[hugeicons--loading-03] size-4 animate-spin"
							aria-hidden="true"
						/>
					)}
					Verify
				</Button>
			</form>
			<Button
				variant="link"
				className="text-muted-foreground"
				onClick={() => {
					setMode(mode === "totp" ? "backup" : "totp");
					setCode("");
				}}
			>
				{mode === "totp"
					? "Use a backup code instead"
					: "Use your authenticator app instead"}
			</Button>
		</AuthShell>
	);
}
