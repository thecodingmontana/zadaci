import { useRouteContext, useRouter } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { AddPasskeyButton } from "#/components/auth/passkey-buttons";
import { ConfirmModal } from "#/components/q/confirm";
import { Modal } from "#/components/q/modal";
import { authClient } from "#/lib/auth-client";
import { ago } from "#/lib/time";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { GitHubAccountRow } from "./github-account";
import { SBlock, SettingsHeader, SRow } from "./ui";

/** better-auth resolves with `{ error }` instead of rejecting; this rejects so toast.promise sees the failure. */
async function unwrap<T>(
	call: Promise<{ data: T; error: { message?: string } | null }>,
): Promise<T> {
	const { data, error } = await call;
	if (error) throw new Error(error.message ?? "Something went wrong");
	return data;
}

// first match wins: Edge, Opera and the rest also say "Chrome", and Chrome also says "Safari"
const BROWSERS: [RegExp, string, string][] = [
	[/Edg(e|A|iOS)?\//, "Edge", "icon-[logos--microsoft-edge]"],
	[/OPR\/|Opera/, "Opera", "icon-[logos--opera]"],
	[/Vivaldi\//, "Vivaldi", "icon-[logos--vivaldi-icon]"],
	[/SamsungBrowser\//, "Samsung Internet", "icon-[solar--global-linear]"],
	[/YaBrowser\//, "Yandex", "icon-[logos--yandex-ru]"],
	[/DuckDuckGo\//, "DuckDuckGo", "icon-[logos--duckduckgo]"],
	[/Firefox\/|FxiOS\//, "Firefox", "icon-[logos--firefox]"],
	[/Chrome\/|CriOS\//, "Chrome", "icon-[logos--chrome]"],
	[/Safari\//, "Safari", "icon-[logos--safari]"],
];

/** "Chrome on macOS" and the browser's logo, from a user agent string. */
export function describeDevice(ua: string | null | undefined) {
	const [, browser, icon] = BROWSERS.find(([re]) => re.test(ua ?? "")) ?? [
		null,
		ua ? "Browser" : "Unknown device",
		/iPhone|iPad|Android|Mobile/.test(ua ?? "")
			? "icon-[solar--smartphone-linear]"
			: "icon-[solar--monitor-linear]",
	];
	const os = !ua
		? ""
		: /iPhone|iPad/.test(ua)
			? "iOS"
			: /Android/.test(ua)
				? "Android"
				: /Mac OS X/.test(ua)
					? "macOS"
					: /Windows/.test(ua)
						? "Windows"
						: /Linux/.test(ua)
							? "Linux"
							: "";
	return { label: os ? `${browser} on ${os}` : browser, icon };
}

type Passkey = {
	id: string;
	name?: string | null;
	createdAt: string | Date;
	backedUp: boolean;
};

export function PasskeysSection({ title }: { title: string }) {
	const [keys, setKeys] = useState<Passkey[] | null>(null);
	const [renaming, setRenaming] = useState<Passkey | null>(null);
	const [removing, setRemoving] = useState<Passkey | null>(null);
	const [name, setName] = useState("");

	const load = useCallback(async () => {
		const { data } = await authClient.passkey.listUserPasskeys();
		setKeys((data as Passkey[] | null) ?? []);
	}, []);
	useEffect(() => {
		load();
	}, [load]);

	async function rename(event: FormEvent) {
		event.preventDefault();
		if (!renaming || !name.trim()) return;
		try {
			await toast.promise(
				unwrap(
					authClient.passkey.updatePasskey({
						id: renaming.id,
						name: name.trim(),
					}),
				),
				{
					loading: "Renaming passkey…",
					success: "Passkey renamed",
					error: "Couldn't rename passkey",
				},
			);
		} catch {
			return;
		}
		setRenaming(null);
		load();
	}

	return (
		<>
			<SettingsHeader
				title={title}
				lead="Sign in with your fingerprint, face, or device PIN instead of a code."
			/>
			{keys === null ? (
				<div className="srow">
					<span className="sk" style={{ height: 14, width: 180 }} />
				</div>
			) : keys.length === 0 ? (
				<p className="faint" style={{ padding: "12px 0" }}>
					No passkeys yet.
				</p>
			) : (
				keys.map((k) => (
					<SRow
						key={k.id}
						t={
							<span className="row" style={{ gap: 8 }}>
								<span
									className="icon-[solar--key-minimalistic-linear] size-[15px]"
									aria-hidden="true"
								/>
								{k.name || "Passkey"}
								{k.backedUp && <span className="badge green">Synced</span>}
							</span>
						}
						d={`Added ${new Date(k.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
					>
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => {
								setName(k.name ?? "");
								setRenaming(k);
							}}
						>
							Rename
						</button>
						<button
							type="button"
							className="btn btn-danger-ghost btn-sm"
							onClick={() => setRemoving(k)}
						>
							Remove
						</button>
					</SRow>
				))
			)}
			<div style={{ marginTop: 16 }}>
				<AddPasskeyButton variant="default" onAdded={load} />
			</div>
			<Modal
				open={!!renaming}
				onOpenChange={(o) => !o && setRenaming(null)}
				title="Rename passkey"
				size="sm"
				footer={
					<>
						<span className="sp" />
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setRenaming(null)}
						>
							Cancel
						</button>
						<button
							type="submit"
							form="pk-rename"
							className="btn btn-primary"
							disabled={!name.trim()}
						>
							Save
						</button>
					</>
				}
			>
				<form id="pk-rename" className="modal-b" onSubmit={rename}>
					<div className="field">
						<label className="label" htmlFor="pk-name">
							Name
						</label>
						<input
							className="input"
							id="pk-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={60}
							placeholder="e.g. MacBook Touch ID"
						/>
					</div>
				</form>
			</Modal>
			<ConfirmModal
				open={!!removing}
				onOpenChange={(o) => !o && setRemoving(null)}
				title="Remove this passkey?"
				body="You won't be able to sign in with it anymore."
				ok="Remove"
				danger
				onConfirm={async () => {
					if (!removing) return;
					await toast.promise(
						unwrap(authClient.passkey.deletePasskey({ id: removing.id })),
						{
							loading: "Removing passkey…",
							success: "Passkey removed",
							error: "Couldn't remove passkey",
						},
					);
					load();
				}}
			/>
		</>
	);
}

type SessionRow = {
	id: string;
	token: string;
	userAgent?: string | null;
	ipAddress?: string | null;
	updatedAt: string | Date;
};

export function SessionsSection({ title }: { title: string }) {
	const { data: current } = authClient.useSession();
	// "stale": better-auth only lists sessions for a sign-in from the last day
	const [sessions, setSessions] = useState<SessionRow[] | "stale" | null>(null);
	const [confirm, setConfirm] = useState(false);

	const load = useCallback(async () => {
		const { data, error } = await authClient.listSessions();
		if (error?.code === "SESSION_NOT_FRESH") return setSessions("stale");
		if (error)
			toast.error("Couldn't load your sessions", { desc: error.message });
		setSessions((data as SessionRow[] | null) ?? []);
	}, []);
	useEffect(() => {
		load();
	}, [load]);

	const currentId = current?.session.id;
	const sorted = [...(Array.isArray(sessions) ? sessions : [])].sort(
		(a, b) => Number(b.id === currentId) - Number(a.id === currentId),
	);

	return (
		<>
			<SettingsHeader
				title={title}
				lead="Devices currently signed in to your account."
			/>
			{sessions === null ? (
				<div className="srow">
					<span className="sk" style={{ height: 14, width: 200 }} />
				</div>
			) : sessions === "stale" ? (
				<div className="srow">
					<p className="muted grow" style={{ fontSize: 13 }}>
						For your security, sign in again to see and manage your sessions.
					</p>
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={async () => {
							await authClient.signOut();
							window.location.href = `/auth/signin?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
						}}
					>
						Sign in again
					</button>
				</div>
			) : (
				sorted.map((s) => {
					const mine = s.id === currentId;
					const device = describeDevice(s.userAgent);
					return (
						<SRow
							key={s.id}
							t={
								<span className="row" style={{ gap: 8 }}>
									<span
										className={cn(device.icon, "size-4 shrink-0")}
										aria-hidden="true"
									/>
									{device.label}
									{mine && <span className="badge green">This device</span>}
								</span>
							}
							d={`${s.ipAddress || "Unknown location"} · ${mine ? "Active now" : ago(s.updatedAt)}`}
						>
							{!mine && (
								<button
									type="button"
									className="btn btn-secondary btn-sm"
									onClick={() => {
										toast
											.promise(
												unwrap(authClient.revokeSession({ token: s.token })),
												{
													loading: "Signing out that session…",
													success: "Session signed out",
													error: "Couldn't sign out that session",
												},
											)
											.then(load)
											.catch(() => {});
									}}
								>
									Sign out
								</button>
							)}
						</SRow>
					);
				})
			)}
			<div style={{ marginTop: 16 }}>
				<button
					type="button"
					className="btn btn-danger-ghost"
					disabled={sorted.length <= 1}
					onClick={() => setConfirm(true)}
				>
					Sign out of all other sessions
				</button>
			</div>
			<ConfirmModal
				open={confirm}
				onOpenChange={setConfirm}
				title="Sign out of all other sessions?"
				body="You'll stay signed in on this device. Other devices will need to sign in again."
				ok="Sign out others"
				danger
				icon="icon-[solar--logout-2-linear]"
				onConfirm={async () => {
					await toast.promise(unwrap(authClient.revokeOtherSessions()), {
						loading: "Signing out other sessions…",
						success: "Signed out of all other sessions",
						error: "Couldn't sign out other sessions",
					});
					load();
				}}
			/>
			<ConnectedApps />
		</>
	);
}

// every MCP client takes the same address; how you give it to them differs
const MCP_URL = () => `${window.location.origin}/api/mcp`;
const SETUPS: {
	id: string;
	label: string;
	icon: string;
	how: string;
	code: (url: string) => string;
}[] = [
	{
		id: "claude",
		label: "Claude",
		icon: "icon-[logos--claude-icon]",
		how: "In Claude (web, desktop or mobile): Settings → Connectors → Add custom connector, and paste this address.",
		code: (u) => u,
	},
	{
		id: "claude-code",
		label: "Claude Code",
		icon: "icon-[logos--claude-icon]",
		how: "Run this in your terminal, then ask Claude Code anything about your Zadaci work.",
		code: (u) => `claude mcp add --transport http zadaci ${u}`,
	},
	{
		id: "codex",
		label: "Codex",
		icon: "icon-[logos--openai-icon]",
		how: "Run these in your terminal: add Zadaci, then sign in.",
		code: (u) => `codex mcp add zadaci --url ${u}\ncodex mcp login zadaci`,
	},
	{
		id: "cursor",
		label: "Cursor",
		icon: "icon-[simple-icons--cursor]",
		how: "Add this to ~/.cursor/mcp.json (or .cursor/mcp.json in a project).",
		code: (u) =>
			JSON.stringify({ mcpServers: { zadaci: { url: u } } }, null, 2),
	},
	{
		id: "vscode",
		label: "VS Code",
		icon: "icon-[logos--visual-studio-code]",
		how: "Run this in your terminal to add Zadaci to VS Code.",
		code: (u) =>
			`code --add-mcp '${JSON.stringify({ name: "zadaci", type: "http", url: u })}'`,
	},
	{
		id: "gemini",
		label: "Gemini CLI",
		icon: "icon-[simple-icons--googlegemini]",
		how: "Run this in your terminal.",
		code: (u) => `gemini mcp add --transport http zadaci ${u}`,
	},
	{
		id: "other",
		label: "Other",
		icon: "icon-[solar--plug-circle-linear]",
		how: "Any app that supports remote MCP servers over HTTP: give it this address. It signs you in with Zadaci the first time.",
		code: (u) => u,
	},
];

/** How to connect each agent: pick yours, copy its setup. */
function ConnectAgent() {
	const [id, setId] = useState(SETUPS[0]?.id);
	const setup = SETUPS.find((s) => s.id === id) ?? SETUPS[0];
	if (!setup) return null;
	const code = setup.code(MCP_URL());
	return (
		<div className="mcp-connect">
			<b style={{ fontWeight: 500 }}>Connect an agent</b>
			<div
				className="seg"
				role="tablist"
				aria-label="Your agent"
				style={{ flexWrap: "wrap", alignSelf: "flex-start" }}
			>
				{SETUPS.map((s) => (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={s.id === id}
						className={cn(s.id === id && "on")}
						onClick={() => setId(s.id)}
					>
						<span className={cn(s.icon, "size-3.5")} aria-hidden="true" />
						{s.label}
					</button>
				))}
			</div>
			<p className="muted" style={{ fontSize: 13 }}>
				{setup.how}
			</p>
			<div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
				<pre
					className="mcp-cmd grow"
					style={{ whiteSpace: "pre-wrap", margin: 0 }}
				>
					{code}
				</pre>
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() =>
						copy(
							code,
							setup.id === "claude" || setup.id === "other"
								? "address"
								: "setup",
						)
					}
				>
					<span
						className="icon-[solar--copy-linear] size-3.5"
						aria-hidden="true"
					/>
					Copy
				</button>
			</div>
		</div>
	);
}

// the app's own logo when we know it by name: colour logos where they're square, simple-icons
// marks where the colour one is a wide wordmark (written out in full so Tailwind generates them)
const BRANDS: [RegExp, string][] = [
	[/claude|anthropic/i, "icon-[logos--claude-icon]"],
	[/cursor/i, "icon-[simple-icons--cursor]"],
	[/copilot/i, "icon-[logos--github-copilot]"],
	[/vs ?code|visual studio code/i, "icon-[logos--visual-studio-code]"],
	[/codex|openai|chatgpt/i, "icon-[logos--openai-icon]"],
	[/gemini/i, "icon-[simple-icons--googlegemini]"],
	[/cline/i, "icon-[simple-icons--cline]"],
	[/jetbrains|intellij|webstorm/i, "icon-[logos--jetbrains]"],
	[/perplexity/i, "icon-[logos--perplexity-icon]"],
	[/mistral/i, "icon-[logos--mistral-ai-icon]"],
	[/replit/i, "icon-[logos--replit-icon]"],
	[/windsurf|codeium/i, "icon-[simple-icons--windsurf]"],
	[/\bzed\b/i, "icon-[simple-icons--zedindustries]"],
];
const brandIcon = (name: string) =>
	BRANDS.find(([re]) => re.test(name))?.[1] ??
	"icon-[solar--plug-circle-linear]";

type Consent = { id: string; clientId: string; createdAt: string };

/** AI agents (Claude Code, Cursor…) you let use Zadaci as you, through its MCP server. */
function ConnectedApps() {
	const [apps, setApps] = useState<(Consent & { name: string })[] | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const load = useCallback(async () => {
		const res = await fetch("/api/auth/oauth2/get-consents");
		const list = res.ok ? ((await res.json()) as Consent[]) : [];
		const named = await Promise.all(
			list.map(async (c) => {
				const r = await fetch(
					`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(c.clientId)}`,
				);
				const info = r.ok ? ((await r.json()) as { client_name?: string }) : {};
				return { ...c, name: info.client_name || "An app" };
			}),
		);
		setApps(named);
	}, []);
	useEffect(() => {
		load();
	}, [load]);

	return (
		<>
			<div
				className="row"
				style={{ marginTop: 36, alignItems: "flex-start", gap: 12 }}
			>
				<div className="grow">
					<SettingsHeader
						title="Connected apps"
						lead="GitHub, and AI agents you let use Zadaci as you, with your role in each workspace. Disconnecting stops one at once."
					/>
				</div>
				{/* just connected an agent in another window: see it here without reloading the app */}
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					disabled={refreshing}
					aria-busy={refreshing}
					onClick={async () => {
						setRefreshing(true);
						await load().catch(() => toast.error("Couldn't refresh the list"));
						setRefreshing(false);
					}}
				>
					<span
						className={cn(
							"icon-[solar--refresh-linear] size-3.5",
							refreshing && "animate-spin",
						)}
						aria-hidden="true"
					/>
					Refresh
				</button>
			</div>
			<GitHubAccountRow />
			{apps === null ? (
				<div className="srow">
					<span className="sk" style={{ height: 14, width: 200 }} />
				</div>
			) : apps.length === 0 ? (
				<div className="srow">
					<p className="muted grow" style={{ fontSize: 13 }}>
						No AI agents connected yet.
					</p>
				</div>
			) : (
				apps.map((a) => (
					<SRow
						key={a.id}
						t={
							<span className="row" style={{ gap: 8 }}>
								<span
									className={cn(brandIcon(a.name), "size-4 shrink-0")}
									aria-hidden="true"
								/>
								{a.name}
							</span>
						}
						d={`Connected ${ago(a.createdAt)}`}
					>
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => {
								toast
									.promise(
										fetch("/api/auth/oauth2/delete-consent", {
											method: "POST",
											headers: { "content-type": "application/json" },
											body: JSON.stringify({ id: a.id }),
										}).then((r) => {
											if (!r.ok) throw new Error("failed");
										}),
										{
											loading: `Disconnecting ${a.name}…`,
											success: `${a.name} disconnected`,
											error: "Couldn't disconnect it",
										},
									)
									.then(load)
									.catch(() => {});
							}}
						>
							Disconnect
						</button>
					</SRow>
				))
			)}
			<ConnectAgent />
		</>
	);
}

function RecoveryCodes({ codes }: { codes: string[] }) {
	return (
		<>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(2,max-content)",
					gap: "6px 28px",
					fontFamily: "var(--q-mono)",
					fontSize: 13,
					padding: 14,
					border: "1px solid var(--q-border)",
					borderRadius: "var(--q-r)",
					background: "var(--q-sunken)",
					userSelect: "all",
				}}
			>
				{codes.map((c) => (
					<span key={c}>{c}</span>
				))}
			</div>
			<div className="row" style={{ marginTop: 10 }}>
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() => {
						copy(codes.join("\n"), "recovery codes");
					}}
				>
					<span
						className="icon-[solar--copy-linear] size-[13px]"
						aria-hidden="true"
					/>
					Copy
				</button>
				<a
					className="btn btn-secondary btn-sm"
					href={`data:text/plain;charset=utf-8,${encodeURIComponent(codes.join("\n"))}`}
					download="zadaci-recovery-codes.txt"
				>
					<span
						className="icon-[solar--download-minimalistic-linear] size-[13px]"
						aria-hidden="true"
					/>
					Download
				</a>
			</div>
		</>
	);
}

export function TwoFactorSection({ title }: { title: string }) {
	const { user } = useRouteContext({ from: "/_authed" });
	const router = useRouter();
	const on = !!user.twoFactorEnabled;
	const [setup, setSetup] = useState<{ uri: string; codes: string[] } | null>(
		null,
	);
	const [codes, setCodes] = useState<string[] | null>(null);
	const [code, setCode] = useState("");
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);
	const [confirm, setConfirm] = useState(false);

	async function start() {
		setBusy(true);
		const data = await toast
			.promise(
				unwrap(authClient.twoFactor.enable({ method: "totp" })).then((d) => {
					if (d?.method !== "totp") throw new Error("Unexpected setup method");
					return d;
				}),
				{
					loading: "Starting setup…",
					success: "Scan the QR code with your authenticator app",
					error: "Couldn't start setup",
				},
			)
			.catch(() => null);
		setBusy(false);
		if (!data) return;
		setErr("");
		setCode("");
		setSetup({ uri: data.totpURI, codes: data.backupCodes });
	}

	async function verify(event: FormEvent) {
		event.preventDefault();
		if (!/^\d{6}$/.test(code.trim()))
			return setErr("Enter the 6-digit code from your app");
		setBusy(true);
		try {
			await toast.promise(
				unwrap(authClient.twoFactor.verifyTotp({ code: code.trim() })),
				{
					loading: "Verifying code…",
					success: "Two-factor authentication is on",
					error: "That code didn't work",
				},
			);
		} catch {
			return setErr(
				"That code didn't work. Wait for the next one and try again.",
			);
		} finally {
			setBusy(false);
		}
		setCodes(setup?.codes ?? null);
		setSetup(null);
		await router.invalidate();
	}

	return (
		<>
			<SettingsHeader title={title} lead="Add a second step when signing in." />
			{on ? (
				<>
					<div className="alert ok">
						<span
							className="i icon-[solar--shield-check-linear] size-4 shrink-0"
							aria-hidden="true"
						/>
						<div>
							<b>Two-factor authentication is on.</b>
							<div className="muted">
								You'll enter a code from your authenticator app when signing in
								on a new device.
							</div>
						</div>
					</div>
					<SBlock title="Recovery codes">
						<p className="muted" style={{ fontSize: 13 }}>
							Store these somewhere safe. Each code works once.
							{!codes &&
								" Generate a new set if you've used yours or can't find them; the old set stops working."}
						</p>
						{codes ? (
							<RecoveryCodes codes={codes} />
						) : (
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => {
									toast
										.promise(
											unwrap(authClient.twoFactor.generateBackupCodes({})),
											{
												loading: "Generating recovery codes…",
												success: "New recovery codes generated",
												error: "Couldn't generate codes",
											},
										)
										.then((data) => data && setCodes(data.backupCodes))
										.catch(() => {});
								}}
							>
								Generate new recovery codes
							</button>
						)}
						<div style={{ marginTop: 14 }}>
							<button
								type="button"
								className="btn btn-danger-ghost"
								onClick={() => setConfirm(true)}
							>
								Turn off two-factor authentication
							</button>
						</div>
					</SBlock>
				</>
			) : setup ? (
				<div
					className="panel"
					style={{ padding: 18, display: "flex", gap: 20, flexWrap: "wrap" }}
				>
					<div
						style={{
							padding: 8,
							background: "#fff",
							borderRadius: 8,
							border: "1px solid var(--q-border)",
							height: "fit-content",
						}}
					>
						<QRCodeSVG
							value={setup.uri}
							size={132}
							title="Authenticator setup QR code"
						/>
					</div>
					<div className="grow col" style={{ gap: 10, minWidth: 220 }}>
						<div>
							<b>1. Scan the QR code</b>
							<div className="muted" style={{ fontSize: 13 }}>
								Use 1Password, Authy, or Google Authenticator.
							</div>
							<details
								className="muted"
								style={{ fontSize: 12.5, marginTop: 4 }}
							>
								<summary style={{ cursor: "pointer" }}>
									Can't scan it? Enter the key manually
								</summary>
								<code
									className="mono"
									style={{ userSelect: "all", wordBreak: "break-all" }}
								>
									{new URL(setup.uri).searchParams.get("secret")}
								</code>
							</details>
						</div>
						<div>
							<b>2. Enter the 6-digit code</b>
						</div>
						<form onSubmit={verify} className="row">
							<input
								className={cn("input mono", err && "is-error")}
								id="tfa-code"
								inputMode="numeric"
								autoComplete="one-time-code"
								maxLength={6}
								placeholder="000000"
								style={{ width: 130, letterSpacing: ".2em", fontSize: 15 }}
								value={code}
								onChange={(e) => setCode(e.target.value)}
								aria-label="6-digit code"
								aria-invalid={!!err}
								aria-describedby={err ? "tfa-err" : undefined}
							/>
							<button
								type="submit"
								className={cn("btn btn-primary", busy && "is-loading")}
								disabled={busy}
							>
								Verify
							</button>
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => setSetup(null)}
							>
								Cancel
							</button>
						</form>
						{err && (
							<span className="err" id="tfa-err" role="alert">
								<span
									className="icon-[solar--danger-circle-linear] size-3"
									aria-hidden="true"
								/>
								{err}
							</span>
						)}
					</div>
				</div>
			) : (
				<div className="panel" style={{ padding: 18 }}>
					<div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
						<span
							className="ftype"
							style={
								{
									"--c": "var(--q-amber)",
									width: 36,
									height: 36,
								} as React.CSSProperties
							}
						>
							<span
								className="icon-[solar--shield-warning-linear] size-[18px]"
								aria-hidden="true"
							/>
						</span>
						<div className="grow">
							<b>Two-factor authentication is off</b>
							<p
								className="muted"
								style={{ margin: "4px 0 12px", fontSize: 13 }}
							>
								Optional: ask for a code from an authenticator app each time you
								sign in.
							</p>
							<button
								type="button"
								className={cn("btn btn-primary", busy && "is-loading")}
								onClick={start}
								disabled={busy}
							>
								Set up two-factor authentication
							</button>
						</div>
					</div>
					{codes && (
						<div style={{ marginTop: 16 }}>
							<RecoveryCodes codes={codes} />
						</div>
					)}
				</div>
			)}
			<ConfirmModal
				open={confirm}
				onOpenChange={setConfirm}
				title="Turn off two-factor authentication?"
				body="Signing in will no longer ask for a code from your authenticator app."
				ok="Turn off"
				danger
				icon="icon-[solar--shield-cross-linear]"
				onConfirm={async () => {
					await toast.promise(unwrap(authClient.twoFactor.disable({})), {
						loading: "Turning off two-factor…",
						success: "Two-factor authentication is off",
						error: "Couldn't turn it off",
					});
					setCodes(null);
					await router.invalidate();
				}}
			/>
		</>
	);
}
