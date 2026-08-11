import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/vue-query";
import { contributionsKey } from "./use-contributions";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const config = useRuntimeConfig();
  const url = config.public.supabase.url as string;
  const anonKey = config.public.supabase.anonKey as string;
  if (!url || !anonKey) return null;
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

/**
 * Tier 2 realtime invalidation for the contribution grid.
 *
 * Subscribes to postgres changes on `app_contribution` (any row, any user —
 * the query is cheap and the dashboard is shared) and invalidates the
 * contributions query so the grid updates live.
 */
export function useContributionsRealtime() {
  const queryClient = useQueryClient();
  let channel: RealtimeChannel | null = null;

  onUnmounted(() => {
    stop();
  });

  function start() {
    if (import.meta.server) return;
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("[contributions-realtime] No Supabase client — skipping");
      return;
    }

    stop();

    channel = supabase
      .channel("app_contribution_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_contribution",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: contributionsKey() });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.log("[contributions-realtime] Subscription status:", status);
        }
      });
  }

  function stop() {
    if (channel) {
      getSupabase()?.removeChannel(channel);
      channel = null;
    }
  }

  return { start, stop };
}
