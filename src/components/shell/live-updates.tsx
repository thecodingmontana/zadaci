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
// the chat list only shows unread counts (an open conversation gets its messages at once), so a
// busy workspace reloads it far less often
const CHAT_GAP_MS = 10_000;

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
		void import("@supabase/realtime-js").then(async ({ RealtimeClient }) => {
			if (gone) return;
			const realtime = new RealtimeClient(`${config.url}/realtime/v1`, {
				params: { apikey: config.anonKey },
				// private channels: a short-lived signed-in token, fetched again as it runs out
				...(config.private && { accessToken: realtimeToken }),
			});
			// a channel reads the token when it joins: have it first, or the join goes out signed-out
			// and Supabase refuses the private channel
			if (config.private) await realtime.setAuth();
			if (gone) return realtime.disconnect();
			const refresh = spaced(() =>
				client.refetchQueries({ include: "active" }),
			);
			const refreshChats = spaced(
				() => client.refetchQueries({ include: ["ChatChannels"] }),
				CHAT_GAP_MS,
			);
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
					if (message.payload?.from !== TAB_ID) refresh();
				})
				// a chat message somewhere: the sidebar's unread counts (the open conversation listens itself)
				.on("broadcast", { event: "chat" }, (message) => {
					// not once per message: at most every CHAT_GAP_MS
					if (message.payload?.from !== TAB_ID) refreshChats();
				})
				// back after the connection dropped (a sleeping laptop, a phone offline): catch up once
				.subscribe((status) => {
					if (status !== "SUBSCRIBED") return;
					if (memberId) void channel.track({ at: Date.now() });
					if (connected) void client.refetchQueries({ include: "active" });
					connected = true;
				});
			stop = () => {
				refresh.cancel();
				refreshChats.cancel();
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

/** Runs `run` soon after a call, once for a burst of calls (a bulk edit becomes one refresh), and
 *  no more often than every `gapMs`. */
export function spaced(run: () => unknown, gapMs = MIN_GAP_MS) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let last = 0;
	const call = () => {
		if (timer) return;
		timer = setTimeout(
			() => {
				timer = undefined;
				last = Date.now();
				void run();
			},
			Math.max(SETTLE_MS, last + gapMs - Date.now()),
		);
	};
	call.cancel = () => clearTimeout(timer);
	return call;
}

/** A token for Realtime's private channels (better-auth's jwt plugin); null when signed out. */
export async function realtimeToken() {
	const res = await fetch("/api/auth/token", { credentials: "same-origin" });
	if (!res.ok) return null;
	return ((await res.json()) as { token?: string }).token ?? null;
}
