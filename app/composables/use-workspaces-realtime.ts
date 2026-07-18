import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/vue-query";

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

export function useWorkspacesRealtime() {
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

    channel = supabase
      .channel("app_workspaces_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_workspace" }, () => {
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      })
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
