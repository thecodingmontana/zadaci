import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { AuthShell } from "#/components/auth/auth-shell";
import { AddPasskeyButton } from "#/components/auth/passkey-buttons";
import { TotpInput } from "#/components/auth/totp-input";
import { ArrowChip, Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";
import { takeNext } from "#/lib/next-path";
import { getSession } from "#/lib/session";
import { toast } from "#/lib/toast";

export const Route = createFileRoute("/auth/two-factor/setup")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/auth/signin" });
		if (session.secured) throw redirect({ to: "/workspace" });
		return { user: session.user };
	},
	head: () => ({ meta: [{ title: "Set up two-step verification - Zadaci" }] }),
	component: SetupTwoFactor,
});

type Step =
	| { name: "intro" }
	| { name: "scan"; totpURI: string; backupCodes: string[] }
	| { name: "backup"; backupCodes: string[] };

function SetupTwoFactor() {
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>({ name: "intro" });
	const [code, setCode] = useState("");
	const [isBusy, setIsBusy] = useState(false);

	async function start() {
		setIsBusy(true);
		const { data, error } = await authClient.twoFactor.enable({
			method: "totp",
		});
		setIsBusy(false);
		if (error || data?.method !== "totp")
			return toast.error(error?.message ?? "Couldn't start setup. Try again.");
		setStep({
			name: "scan",
			totpURI: data.totpURI,
			backupCodes: data.backupCodes,
		});
	}

	async function confirm(value: string) {
		if (step.name !== "scan") return;
		setIsBusy(true);
		const { error } = await authClient.twoFactor.verifyTotp({ code: value });
		setIsBusy(false);
		setCode("");
		if (error)
			return toast.error(
				"That code didn't work. Wait for the next code and try again.",
			);
		setStep({ name: "backup", backupCodes: step.backupCodes });
	}

	async function signOut() {
		await authClient.signOut();
		navigate({ to: "/auth/signin" });
	}

	if (step.name === "intro") {
		return (
			<AuthShell
				title="Protect your account"
				description={
					<>
						Signed in as{" "}
						<span className="font-medium text-foreground">{user.email}</span>.
						Zadaci requires a second step when you sign in: a passkey on this
						device, or an authenticator app such as Google Authenticator,
						1Password or Authy.
					</>
				}
			>
				<Button size="lg" disabled={isBusy} onClick={start}>
					{isBusy ? (
						<span
							className="icon-[hugeicons--loading-03] size-4 animate-spin"
							aria-hidden="true"
						/>
					) : (
						<span
							className="icon-[solar--shield-keyhole-bold] size-4"
							aria-hidden="true"
						/>
					)}
					Set up authenticator app
				</Button>
				<AddPasskeyButton
					size="lg"
					className="w-full"
					label="Use a passkey"
					onAdded={() => navigate({ href: takeNext() })}
				/>
				<Button
					variant="link"
					className="text-muted-foreground"
					onClick={signOut}
				>
					Use a different Google account
				</Button>
			</AuthShell>
		);
	}

	if (step.name === "scan") {
		const secret = new URL(step.totpURI).searchParams.get("secret") ?? "";
		return (
			<AuthShell
				title="Scan the QR code"
				description="Scan it with your authenticator app, then enter the 6-digit code it shows."
			>
				<div className="mx-auto rounded-xl border bg-white p-3">
					<QRCodeSVG
						value={step.totpURI}
						size={176}
						title="Authenticator setup QR code"
					/>
				</div>
				<details className="text-center text-sm text-muted-foreground">
					<summary className="cursor-pointer">
						Can't scan it? Enter the key manually
					</summary>
					<code className="mt-2 block font-ibm-plex-mono text-sm break-all text-foreground select-all">
						{secret}
					</code>
				</details>
				<TotpInput
					value={code}
					onChange={setCode}
					onComplete={confirm}
					disabled={isBusy}
				/>
			</AuthShell>
		);
	}

	const codesText = step.backupCodes.join("\n");
	return (
		<AuthShell
			title="Save your backup codes"
			description="Each code works once. Use them to sign in if you lose access to your authenticator app. You won't see them again."
		>
			<ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-ibm-plex-mono text-sm tabular-nums">
				{step.backupCodes.map((backupCode) => (
					<li key={backupCode} className="text-center select-all">
						{backupCode}
					</li>
				))}
			</ul>
			<div className="grid grid-cols-2 gap-2">
				<Button
					variant="outline"
					onClick={async () => {
						await navigator.clipboard.writeText(codesText);
						toast.success("Backup codes copied");
					}}
				>
					<span
						className="icon-[solar--copy-linear] size-4"
						aria-hidden="true"
					/>
					Copy
				</Button>
				<Button variant="outline" asChild>
					<a
						href={`data:text/plain;charset=utf-8,${encodeURIComponent(codesText)}`}
						download="zadaci-backup-codes.txt"
					>
						<span
							className="icon-[solar--download-minimalistic-linear] size-4"
							aria-hidden="true"
						/>
						Download
					</a>
				</Button>
			</div>
			<AddPasskeyButton className="w-full" />
			<Button size="lg" onClick={() => navigate({ href: takeNext() })}>
				I've saved my codes
				<ArrowChip />
			</Button>
		</AuthShell>
	);
}
