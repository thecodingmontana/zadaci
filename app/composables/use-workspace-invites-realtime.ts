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
    if (!supabase) return;
    const id = workspaceId();
    if (!id) return;

    channel = supabase
      .channel(`app_workspace_invites_realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_workspace_invite_request",
          filter: `workspace_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: workspaceInvitesKey(id) });
        },
      )
      .subscribe((status) => {
        realtimeStatus.value = status;
      });

    cleanupFns.push(() => {
      if (channel) {
        getSupabase()?.removeChannel(channel);
        channel = null;
      }
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
