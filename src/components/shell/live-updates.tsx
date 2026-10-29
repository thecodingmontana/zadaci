import { useApolloClient, useQuery } from "@apollo/client/react";
import { useEffect } from "react";
import { REALTIME_CONFIG } from "#/graphql/operations";
import { setOnline } from "#/lib/online";
import { TAB_ID } from "#/lib/tab";

// Listens for "this workspace changed" over Supabase Realtime (sent by the server after any change,
// by you, a teammate or Zad) and refreshes what's on screen. Nothing is shown; it just keeps the
// page current without a reload.

const SETTLE_MS = 400;
// anyone holding the public key can post to the channel, so however many messages arrive,
// a page refreshes at most this often
const MIN_GAP_MS = 3000;

export function LiveUpdates({
	workspaceId,
	memberId,
}: {
	workspaceId: string;
	/** yours: shared as "online" while this tab is open */
	memberId?: string;
}) {
	const client = useApolloClient();
	const config = useQuery(REALTIME_CONFIG, { fetchPolicy: "cache-first" }).data
		?.realtime;
	useEffect(() => {
		if (!config) return;
		let stop: (() => void) | undefined;
		let gone = false;
		// the connection library loads once the page is up, not with it
		void import("@supabase/realtime-js").then(({ RealtimeClient }) => {
			if (gone) return;
			const realtime = new RealtimeClient(`${config.url}/realtime/v1`, {
				params: { apikey: config.anonKey },
				// private channels: a short-lived signed-in token, fetched again as it runs out
				...(config.private && { accessToken: realtimeToken }),
			});
			let timer: ReturnType<typeof setTimeout> | undefined;
			let last = 0;
			let connected = false;
			const channel = realtime
				.channel(`ws:${workspaceId}`, {
					// presence keyed by member, so several tabs count as one person
					config: {
						private: config.private,
						...(memberId && { presence: { key: memberId } }),
					},
				})
				// who's online: everyone sharing presence here (shortcut: a member could claim another's
				// id, since presence is what the browser says; harmless while it only shows a dot)
				.on("presence", { event: "sync" }, () =>
					setOnline(Object.keys(channel.presenceState())),
				)
				.on("broadcast", { event: "changed" }, (message) => {
					// this tab made the change, so it's already on screen
					if (message.payload?.from === TAB_ID) return;
					// a refresh already on its way covers this change too (a bulk edit becomes one)
					if (timer) return;
					timer = setTimeout(
						() => {
							timer = undefined;
							last = Date.now();
							void client.refetchQueries({ include: "active" });
						},
						Math.max(SETTLE_MS, last + MIN_GAP_MS - Date.now()),
					);
				})
				// a chat message somewhere: the sidebar's unread counts (the open conversation listens itself)
				.on("broadcast", { event: "chat" }, (message) => {
					if (message.payload?.from !== TAB_ID)
						void client.refetchQueries({ include: ["ChatChannels"] });
				})
				// back after the connection dropped (a sleeping laptop, a phone offline): catch up once
				.subscribe((status) => {
					if (status !== "SUBSCRIBED") return;
					if (memberId) void channel.track({ at: Date.now() });
					if (connected) void client.refetchQueries({ include: "active" });
					connected = true;
				});
			stop = () => {
				clearTimeout(timer);
				setOnline([]);
				void realtime.removeChannel(channel);
				realtime.disconnect();
			};
		});
		return () => {
			gone = true;
			stop?.();
		};
	}, [config, workspaceId, memberId, client]);
	return null;
}

/** A token for Realtime's private channels (better-auth's jwt plugin); null when signed out. */
export async function realtimeToken() {
	const res = await fetch("/api/auth/token", { credentials: "same-origin" });
	if (!res.ok) return null;
	return ((await res.json()) as { token?: string }).token ?? null;
}
