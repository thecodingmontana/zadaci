import { useApolloClient, useQuery } from "@apollo/client/react";
import { RealtimeClient } from "@supabase/realtime-js";
import { useEffect } from "react";
import { REALTIME_CONFIG } from "#/graphql/operations";

// Listens for "this workspace changed" over Supabase Realtime (sent by the server after any change,
// by you, a teammate or Zad) and refreshes what's on screen. Nothing is shown; it just keeps the
// page current without a reload.

const SETTLE_MS = 400;

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
		const channel = realtime
			.channel(`ws:${workspaceId}`)
			.on("broadcast", { event: "changed" }, () => {
				// a burst of changes (a bulk edit) becomes one refresh
				clearTimeout(timer);
				timer = setTimeout(
					() => void client.refetchQueries({ include: "active" }),
					SETTLE_MS,
				);
			})
			.subscribe();
		return () => {
			clearTimeout(timer);
			void realtime.removeChannel(channel);
			realtime.disconnect();
		};
	}, [config, workspaceId, client]);
	return null;
}
