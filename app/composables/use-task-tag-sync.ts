import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { TaskTagDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { createClient } from "@supabase/supabase-js";
import { replicateRxCollection } from "rxdb/plugins/replication";

let supabaseClient: ReturnType<typeof createClient> | null = null;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }
  const config = useRuntimeConfig();
  const url = config.public.supabase.url as string;
  const anonKey = config.public.supabase.anonKey as string;
  if (!url || !anonKey) {
    return null;
  }
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

function debounceReSync(fn: () => void, key: string) {
  const existing = debounceTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  debounceTimers.set(
    key,
    setTimeout(() => {
      fn();
      debounceTimers.delete(key);
    }, 400),
  );
}

export function useTaskTagSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    TaskTagDocType,
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
      if (replicationState) {
        replicationState.reSync();
      }
    }, "task_tags");
  }

  async function start() {
    if (import.meta.server) return;

    const requestFetch = useRequestFetch();
    const nuxtApp = useNuxtApp();
    const db = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useTaskTagSync] No RxDB");
      return;
    }
    if (!db.task_tags) {
      console.warn("[useTaskTagSync] No collection");
      return;
    }
    const activeId = workspaceId();
    if (!activeId) {
      console.warn("[useTaskTagSync] No wsId");
      return;
    }

    console.log(`[useTaskTagSync] Starting, workspace=${activeId}`);
    const existingCount = await db.task_tags.count().exec();
    console.log(`[useTaskTagSync] Existing docs: ${existingCount}`);

    replicationState = replicateRxCollection<TaskTagDocType, { updated_at: string; id: string }>({
      replicationIdentifier: `task-tags-ws-${activeId}`,
      collection: db.task_tags,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) return { documents: [], checkpoint: undefined };
          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) params.set("checkpoint", JSON.stringify(checkpoint));
          console.log(`[useTaskTagSync] Pull`, { checkpoint, batchSize });
          const result = await requestFetch(`/api/replication/task-tags/pull?${params}`);
          const docs = (result as any)?.documents ?? [];
          console.log(`[useTaskTagSync] Pull returned ${docs.length} docs`);
          return result as any;
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            console.warn("[useTaskTagSync] Push no wsId");
            return [];
          }
          console.log(`[useTaskTagSync] Push ${rows.length} row(s)`);
          rows.forEach((r) =>
            console.log(
              `[useTaskTagSync]   Push:`,
              r.newDocumentState
                ? JSON.stringify({ id: r.newDocumentState.id }).slice(0, 200)
                : "deleted",
            ),
          );
          const result = await requestFetch(`/api/replication/task-tags/push?workspace_id=${id}`, {
            method: "POST",
            body: rows,
          });
          console.log(`[useTaskTagSync] Push done, ${(result as any[])?.length ?? 0} results`);
          return result as TaskTagDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    replicationState.active$.subscribe((a) => console.log(`[useTaskTagSync] Active:`, a));
    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useTaskTagSync] ❌`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());
    const subCancel = replicationState.canceled$.subscribe((c) =>
      console.log(`[useTaskTagSync] Canceled:`, c),
    );
    cleanupFns.push(() => subCancel.unsubscribe());
    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
    console.log(`[useTaskTagSync] Started`);
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    realtimeChannel = supabase
      .channel("app_task_tags_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_task_tags",
        },
        (payload) => {
          console.log("[rxdb-debug] Realtime channel fired for app_task_tags", payload);
          scheduleReSync();
        },
      )
      .subscribe((status) => {
        console.log("[rxdb-debug] Realtime channel subscribe status (task_tags):", status);
        realtimeStatus.value = status;
      });

    cleanupFns.push(() => {
      if (realtimeChannel) {
        const client = getSupabase();
        if (client) {
          client.removeChannel(realtimeChannel);
        }
        realtimeChannel = null;
      }
    });
  }

  function setupVisibilityListener() {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleReSync();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    cleanupFns.push(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  }

  function stop() {
    if (replicationState) {
      replicationState.cancel();
      replicationState = null;
    }

    for (const fn of cleanupFns) {
      fn();
    }
    cleanupFns = [];

    const timer = debounceTimers.get("task_tags");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("task_tags");
    }

    if (realtimeChannel) {
      const client = getSupabase();
      if (client) {
        client.removeChannel(realtimeChannel);
      }
      realtimeChannel = null;
    }

    isActive.value = false;
  }

  return {
    start,
    stop,
    isActive,
    syncError,
    realtimeStatus,
  };
}
