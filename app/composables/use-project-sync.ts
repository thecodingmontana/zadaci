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
  const realtimeStatus = ref<string>("idle");

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
    if (import.meta.server) return;

    const requestFetch = useRequestFetch();
    const nuxtApp = useNuxtApp();
    const db = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useProjectSync] No RxDB");
      return;
    }
    if (!db.projects) {
      console.warn("[useProjectSync] No collection");
      return;
    }
    const activeId = workspaceId();
    if (!activeId) {
      console.warn("[useProjectSync] No wsId");
      return;
    }

    console.log(`[useProjectSync] Starting, workspace=${activeId}`);
    const existingCount = await db.projects.count().exec();
    console.log(`[useProjectSync] Existing docs: ${existingCount}`);

    replicationState = replicateRxCollection<ProjectDocType, { updated_at: string; id: string }>({
      replicationIdentifier: `projects-ws-${activeId}`,
      collection: db.projects,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) return { documents: [], checkpoint: undefined };
          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            const localCount = await db.projects.count().exec();
            if (localCount > 0) params.set("checkpoint", JSON.stringify(checkpoint));
          }
          console.log(`[useProjectSync] Pull`, { checkpoint, batchSize });
          const result = await requestFetch(`/api/replication/projects/pull?${params}`);
          const docs = (result as any)?.documents ?? [];
          console.log(`[useProjectSync] Pull returned ${docs.length} docs`);
          return result as any;
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            console.warn("[useProjectSync] Push no wsId");
            return [];
          }

          // Skip deletion events — caused by useClearRxDb on workspace switch.
          const filtered = rows.filter((r) => {
            if (!r.newDocumentState) return false;
            const wsId = (r.newDocumentState as any).workspace_id;
            return wsId === undefined || wsId === id;
          });
          const skipped = rows.length - filtered.length;
          if (skipped > 0) {
            console.log(`[useProjectSync] Skipping ${skipped} stale row(s) from other workspaces`);
          }
          if (filtered.length === 0) return [];

          console.log(`[useProjectSync] Push ${filtered.length} row(s)`);
          filtered.forEach((r) =>
            console.log(
              `[useProjectSync]   Push:`,
              r.newDocumentState
                ? JSON.stringify({
                    id: r.newDocumentState.id,
                    workspace_id: (r.newDocumentState as any).workspace_id,
                  }).slice(0, 200)
                : "deleted",
            ),
          );
          const result = await requestFetch(`/api/replication/projects/push?workspace_id=${id}`, {
            method: "POST",
            body: filtered,
          });
          console.log(`[useProjectSync] Push done, ${(result as any[])?.length ?? 0} results`);
          return result as ProjectDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const subActive = replicationState.active$.subscribe((a) =>
      console.log(`[useProjectSync] Active:`, a),
    );
    cleanupFns.push(() => subActive.unsubscribe());
    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useProjectSync] ❌`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());
    const subCancel = replicationState.canceled$.subscribe((c) =>
      console.log(`[useProjectSync] Canceled:`, c),
    );
    cleanupFns.push(() => subCancel.unsubscribe());
    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
    console.log(`[useProjectSync] Started`);
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
        (payload) => {
          console.log("[rxdb-debug] Realtime channel fired for app_project", payload);
          scheduleReSync();
        },
      )
      .subscribe((status) => {
        console.log("[rxdb-debug] Realtime channel subscribe status (projects):", status);
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
    realtimeStatus,
  };
}
