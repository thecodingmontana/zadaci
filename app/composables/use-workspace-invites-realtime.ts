import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/vue-query";
import { workspaceInvitesKey } from "./use-workspace-invites";

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

export function useWorkspaceInvitesRealtime(workspaceId: () => string | undefined) {
  const queryClient = useQueryClient();
  let channel: RealtimeChannel | null = null;
  let cleanupFns: (() => void)[] = [];
  const realtimeStatus = ref<string>("idle");

  onUnmounted(() => {
    stop();
  });

  function start() {
    if (import.meta.server) return;
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("[workspace-invites-realtime] No Supabase client — skipping");
      return;
    }
    const id = workspaceId();
    if (!id) {
      console.warn("[workspace-invites-realtime] No workspace ID — skipping");
      return;
    }

    // Stop any existing subscription before creating a new one
    stop();

    channel = supabase
      .channel(`app_workspace_invites_realtime_${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_workspace_invite_request",
          filter: `workspace_id=eq.${id}`,
        },
        () => {
          console.log("[workspace-invites-realtime] Change detected — invalidating query");
          queryClient.invalidateQueries({ queryKey: workspaceInvitesKey(id) });
        },
      )
      .subscribe((status) => {
        realtimeStatus.value = status;
        console.log("[workspace-invites-realtime] Subscription status:", status);
      });
  }

  function stop() {
    if (channel) {
      getSupabase()?.removeChannel(channel);
      channel = null;
    }
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
  }

  return { start, stop, realtimeStatus };
}
