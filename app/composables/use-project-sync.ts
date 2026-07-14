import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { ProjectDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useProjectSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    ProjectDocType,
    { updated_at: string; id: string }
  > | null = null;
  let realtimeChannel: RealtimeChannel | null = null;
  let cleanupFns: (() => void)[] = [];
  const isActive = ref(false);
  const syncError = ref<Error | null>(null);

  onUnmounted(() => {
    stop();
  });

  function scheduleReSync() {
    debounceReSync(() => {
      if (replicationState) {
        replicationState.reSync();
      }
    }, "projects");
  }

  async function start() {
    if (import.meta.server) {
      return;
    }

    const requestFetch = useRequestFetch();

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      return;
    }

    const projectsCollection = db.projects;
    if (!projectsCollection) {
      return;
    }

    const activeId = workspaceId();
    if (!activeId) {
      return;
    }

    const repId = `projects-ws-${activeId}`;

    replicationState = replicateRxCollection<ProjectDocType, { updated_at: string; id: string }>({
      replicationIdentifier: repId,
      collection: projectsCollection,
      deletedField: "deleted_at",
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) {
            return { documents: [], checkpoint: undefined };
          }

          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            params.set("checkpoint", JSON.stringify(checkpoint));
          }

          const result = await requestFetch(`/api/replication/projects/pull?${params.toString()}`);
          return result as {
            documents: ProjectDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            return [];
          }

          const result = await requestFetch(`/api/replication/projects/push?workspace_id=${id}`, {
            method: "POST",
            body: rows,
          });
          return result as ProjectDocType[];
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

    realtimeChannel = supabase
      .channel("app_projects_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_project",
        },
        () => {
          console.log("[rxdb-debug] Realtime channel fired for app_project");
          scheduleReSync();
        },
      )
      .subscribe();

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

  function stop() {
    if (replicationState) {
      replicationState.cancel();
      replicationState = null;
    }

    for (const fn of cleanupFns) {
      fn();
    }
    cleanupFns = [];

    const timer = debounceTimers.get("projects");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("projects");
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
  };
}
