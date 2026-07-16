import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { UserStatusDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { createClient } from "@supabase/supabase-js";
import { replicateRxCollection } from "rxdb/plugins/replication";

let supabaseClient: ReturnType<typeof createClient> | null = null;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const config = useRuntimeConfig();
  const url = config.public.supabase.url as string;
  const anonKey = config.public.supabase.anonKey as string;
  if (!url || !anonKey) return null;
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

function debounceReSync(fn: () => void, key: string) {
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      fn();
      debounceTimers.delete(key);
    }, 400),
  );
}

export function useUserStatusSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    UserStatusDocType,
    { updated_at: string; id: string }
  > | null = null;
  let realtimeChannel: RealtimeChannel | null = null;
  let cleanupFns: (() => void)[] = [];
  const isActive = ref(false);
  const syncError = ref<Error | null>(null);
  const realtimeStatus = ref<string>("idle");

  onUnmounted(() => {
    stop();
  });

  function scheduleReSync() {
    debounceReSync(() => {
      replicationState?.reSync();
    }, "user_status");
  }

  async function start() {
    if (import.meta.server) return;
    const requestFetch = useRequestFetch();
    const nuxtApp = useNuxtApp();
    const db = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db || !db.user_status) return;
    const activeId = workspaceId();
    if (!activeId) return;

    replicationState = replicateRxCollection({
      replicationIdentifier: `user-status-ws-${activeId}`,
      collection: db.user_status,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) return { documents: [], checkpoint: undefined };
          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) params.set("checkpoint", JSON.stringify(checkpoint));
          const result = await requestFetch(`/api/replication/user-status/pull?${params}`);
          return result as {
            documents: UserStatusDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) return [];
          return await requestFetch(`/api/replication/user-status/push?workspace_id=${id}`, {
            method: "POST",
            body: rows,
          });
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const sub = replicationState.error$.subscribe((err) => {
      syncError.value = err;
    });
    cleanupFns.push(() => sub.unsubscribe());
    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) return;
    realtimeChannel = supabase
      .channel("app_user_status_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_user_status" }, () =>
        scheduleReSync(),
      )
      .subscribe((status) => {
        realtimeStatus.value = status;
      });
    cleanupFns.push(() => {
      if (realtimeChannel) {
        getSupabase()?.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    });
  }

  function setupVisibilityListener() {
    const handler = () => {
      if (document.visibilityState === "visible") scheduleReSync();
    };
    document.addEventListener("visibilitychange", handler);
    cleanupFns.push(() => document.removeEventListener("visibilitychange", handler));
  }

  function stop() {
    replicationState?.cancel();
    replicationState = null;
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    const timer = debounceTimers.get("user_status");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("user_status");
    }
    if (realtimeChannel) {
      getSupabase()?.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    isActive.value = false;
  }

  return { start, stop, isActive, syncError, realtimeStatus };
}
