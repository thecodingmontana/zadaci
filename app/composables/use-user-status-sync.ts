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
    if (!db) {
      console.warn("[useUserStatusSync] No RxDB");
      return;
    }
    if (!db.user_status) {
      console.warn("[useUserStatusSync] No collection");
      return;
    }
    const activeId = workspaceId();
    if (!activeId) {
      console.warn("[useUserStatusSync] No wsId");
      return;
    }

    console.log(`[useUserStatusSync] Starting, workspace=${activeId}`);
    const existingCount = await db.user_status.count().exec();
    console.log(`[useUserStatusSync] Existing docs: ${existingCount}`);

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
          if (checkpoint) {
            const localCount = await db.user_status.count().exec();
            if (localCount > 0) params.set("checkpoint", JSON.stringify(checkpoint));
          }
          console.log(`[useUserStatusSync] Pull`, { checkpoint, batchSize });
          const result = await requestFetch(`/api/replication/user-status/pull?${params}`);
          const docs = (result as any)?.documents ?? [];
          console.log(`[useUserStatusSync] Pull returned ${docs.length} docs`);
          return result as any;
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            console.warn("[useUserStatusSync] Push no wsId");
            return [];
          }
          console.log(`[useUserStatusSync] Push ${rows.length} row(s)`);
          rows.forEach((r) =>
            console.log(
              `[useUserStatusSync]   Push:`,
              r.newDocumentState
                ? JSON.stringify({ id: r.newDocumentState.id }).slice(0, 200)
                : "deleted",
            ),
          );
          const result = await requestFetch(
            `/api/replication/user-status/push?workspace_id=${id}`,
            { method: "POST", body: rows },
          );
          console.log(`[useUserStatusSync] Push done, ${(result as any[])?.length ?? 0} results`);
          return result as UserStatusDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const subActive = replicationState.active$.subscribe((a) =>
      console.log(`[useUserStatusSync] Active:`, a),
    );
    cleanupFns.push(() => subActive.unsubscribe());
    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useUserStatusSync] ❌`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());
    const subCancel = replicationState.canceled$.subscribe((c) =>
      console.log(`[useUserStatusSync] Canceled:`, c),
    );
    cleanupFns.push(() => subCancel.unsubscribe());
    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
    console.log(`[useUserStatusSync] Started`);
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
