import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthShell } from "#/components/auth/auth-shell";
import { Button } from "#/components/ui/button";
import { NOINDEX } from "#/lib/seo";
import { getSession } from "#/lib/session";
import { toast } from "#/lib/toast";

// An AI agent (Claude Code, Cursor, …) asks to use Zadaci as you. Approving lets it do whatever
// your role allows in each of your workspaces, until you disconnect it in Settings.
export const Route = createFileRoute("/oauth/consent")({
	beforeLoad: async ({ location }) => {
		if (!(await getSession()))
			throw redirect({
				to: "/auth/signin",
				search: { redirect: `/oauth/consent${location.searchStr}` },
			});
	},
	head: () => ({ meta: [{ title: "Connect an app - Zadaci" }, NOINDEX] }),
	component: Consent,
});

type PublicClient = { client_name?: string };

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Where approving sends you: the redirect_uri the server signed into this page's address (the
 * app's name and website are whatever it registered itself with, so they prove nothing). */
function destination(search: string) {
	try {
		const url = new URL(new URLSearchParams(search).get("redirect_uri") ?? "");
		return { host: url.host, local: LOCAL_HOSTS.includes(url.hostname) };
	} catch {
		return null;
	}
}

const WHAT_IT_CAN_DO = [
	[
		"icon-[solar--folder-linear]",
		"See and change your projects, tasks, notes and bookmarks",
	],
	[
		"icon-[solar--chat-round-dots-linear]",
		"Read and post in your chats, and comment",
	],
	[
		"icon-[solar--shield-user-linear]",
		"Only what your role allows: nothing you can't do yourself",
	],
	["icon-[solar--link-broken-linear]", "Disconnect it any time in Settings"],
] as const;

function Consent() {
	const [client, setClient] = useState<PublicClient | null>(null);
	const [busy, setBusy] = useState<"accept" | "deny" | null>(null);
	const [clientId, setClientId] = useState<string | null>(null);
	const [dest, setDest] = useState<ReturnType<typeof destination>>(null);

	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("client_id");
		setClientId(id);
		setDest(destination(window.location.search));
		if (!id) return;
		void fetch(
			`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(id)}`,
		)
			.then((r) => (r.ok ? r.json() : null))
			.then((c: PublicClient | null) => setClient(c ?? {}))
			.catch(() => setClient({}));
	}, []);

	async function answer(accept: boolean) {
		setBusy(accept ? "accept" : "deny");
		try {
			const res = await fetch("/api/auth/oauth2/consent", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				// the signed request this page was opened with: the server checks nothing was changed
				body: JSON.stringify({
					accept,
					oauth_query: window.location.search.slice(1),
				}),
			});
			const data = (await res.json().catch(() => null)) as {
				url?: string;
				message?: string;
			} | null;
			if (!res.ok || !data?.url)
				throw new Error(
					data?.message ?? "This request expired. Connect again from your app.",
				);
			window.location.assign(data.url);
		} catch (error) {
			setBusy(null);
			toast.error("Couldn't finish connecting", {
				desc: (error as Error).message,
			});
		}
	}

	// until its details load, a neutral heading (not a flash of "An app")
	const name = client ? client.client_name?.trim() || "An app" : null;
	return (
		<AuthShell
			title={name ? `${name} wants to use Zadaci as you` : "Connect an app"}
			description="It acts with your account and your role in each workspace you belong to."
		>
			<ul className="flex flex-col gap-3 text-sm">
				{WHAT_IT_CAN_DO.map(([icon, text]) => (
					<li key={text} className="flex items-start gap-2.5">
						<span
							className={`${icon} mt-0.5 size-4 shrink-0 text-muted-foreground`}
							aria-hidden="true"
						/>
						<span>{text}</span>
					</li>
				))}
			</ul>
			{dest && (
				<p className="rounded-md border px-3 py-2 text-sm">
					{dest.local ? (
						<>
							After you approve, it continues in an app on <b>this computer</b>{" "}
							({dest.host}).
						</>
					) : (
						<>
							After you approve, you'll be sent to <b>{dest.host}</b>. The name
							above is what the app calls itself: approve only if that's where
							the app you're connecting lives.
						</>
					)}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				Only approve an app you're connecting yourself right now.
			</p>
			<div className="flex gap-2">
				<Button
					variant="outline"
					size="lg"
					className="flex-1"
					disabled={!!busy}
					onClick={() => void answer(false)}
				>
					Deny
				</Button>
				<Button
					size="lg"
					className="flex-1"
					disabled={!!busy || !clientId}
					aria-busy={busy === "accept"}
					onClick={() => void answer(true)}
				>
					{busy === "accept" && (
						<span
							className="icon-[hugeicons--loading-03] size-4 animate-spin"
							aria-hidden="true"
						/>
					)}
					Approve
				</Button>
			</div>
		</AuthShell>
	);
}
