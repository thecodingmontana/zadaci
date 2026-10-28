import { useApolloClient, useQuery } from "@apollo/client/react";
import { RealtimeClient } from "@supabase/realtime-js";
import { useEffect } from "react";
import { REALTIME_CONFIG } from "#/graphql/operations";
import { TAB_ID } from "#/lib/tab";

// Listens for "this workspace changed" over Supabase Realtime (sent by the server after any change,
// by you, a teammate or Zad) and refreshes what's on screen. Nothing is shown; it just keeps the
// page current without a reload.

const SETTLE_MS = 400;
// anyone holding the public key can post to the channel, so however many messages arrive,
// a page refreshes at most this often
const MIN_GAP_MS = 3000;

export function LiveUpdates({ workspaceId }: { workspaceId: string }) {
	const client = useApolloClient();
	const config = useQuery(REALTIME_CONFIG, { fetchPolicy: "cache-first" }).data
		?.realtime;
	useEffect(() => {
		if (!config) return;
		const realtime = new RealtimeClient(`${config.url}/realtime/v1`, {
			params: { apikey: config.anonKey },
		});
		let timer: ReturnType<typeof setTimeout> | undefined;
		let last = 0;
		let connected = false;
		const channel = realtime
			.channel(`ws:${workspaceId}`)
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
			// back after the connection dropped (a sleeping laptop, a phone offline): catch up once
			.subscribe((status) => {
				if (status !== "SUBSCRIBED") return;
				if (connected) void client.refetchQueries({ include: "active" });
				connected = true;
			});
		return () => {
			clearTimeout(timer);
			void realtime.removeChannel(channel);
			realtime.disconnect();
		};
	}, [config, workspaceId, client]);
	return null;
}
