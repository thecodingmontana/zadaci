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

type PublicClient = { client_name?: string; client_uri?: string };

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

	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("client_id");
		setClientId(id);
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
	const host = (() => {
		try {
			return client?.client_uri ? new URL(client.client_uri).host : null;
		} catch {
			return null;
		}
	})();
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
			<p className="text-xs text-muted-foreground">
				{host ? (
					<>
						From <span className="font-medium">{host}</span>.{" "}
					</>
				) : null}
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
