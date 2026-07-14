import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { TaskDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { createClient } from "@supabase/supabase-js";
import { replicateRxCollection } from "rxdb/plugins/replication";

let supabaseClient: ReturnType<typeof createClient> | null = null;

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

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

const REALTIME_DEBOUNCE_MS = 400;

export function useTaskSync(projectIds: () => string[]) {
  let replicationState: RxReplicationState<TaskDocType, { updated_at: string; id: string }> | null =
    null;
  let realtimeChannel: RealtimeChannel | null = null;
  let cleanupFns: (() => void)[] = [];
  const isActive = ref(false);
  const syncError = ref<Error | null>(null);

  onUnmounted(() => {
    stop();
  });

  const debouncedReSync = debounce(() => {
    if (replicationState) {
      replicationState.reSync();
    }
  }, REALTIME_DEBOUNCE_MS);

  async function start() {
    if (import.meta.server) {
      return;
    }

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      return;
    }

    const tasksCollection = db.tasks;
    if (!tasksCollection) {
      return;
    }

    const activeIds = projectIds();
    if (activeIds.length === 0) {
      return;
    }

    const repId = `tasks-${activeIds.sort().join("-")}`;

    replicationState = replicateRxCollection<TaskDocType, { updated_at: string; id: string }>({
      replicationIdentifier: repId,
      collection: tasksCollection,
      deletedField: "deleted_at",
      pull: {
        handler: async (checkpoint, batchSize) => {
          const ids = projectIds();
          if (ids.length === 0) {
            return { documents: [], checkpoint: undefined };
          }

          const params = new URLSearchParams();
          params.set("project_ids", ids.join(","));
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            params.set("checkpoint", JSON.stringify(checkpoint));
          }

          const result = await $fetch(`/api/replication/tasks/pull?${params.toString()}`);
          return result as {
            documents: TaskDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const result = await $fetch("/api/replication/tasks/push", {
            method: "POST",
            body: rows,
          });
          return result as TaskDocType[];
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
    isActive.value = true;
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    const activeIds = projectIds();
    if (activeIds.length === 0) {
      return;
    }

    realtimeChannel = supabase
      .channel("app_tasks_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_tasks",
        },
        (payload) => {
          const changedProjectId = (payload.new as any)?.project_id;
          if (changedProjectId && activeIds.includes(changedProjectId)) {
            debouncedReSync();
          }
        },
      )
      .subscribe();

    cleanupFns.push(() => {
      debouncedReSync.cancel();
      if (realtimeChannel) {
        const client = getSupabase();
        if (client) {
          client.removeChannel(realtimeChannel);
        }
        realtimeChannel = null;
      }
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

    debouncedReSync.cancel();

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
  };
}
