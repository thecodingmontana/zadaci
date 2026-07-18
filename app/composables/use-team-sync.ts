import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { TeamDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useTeamSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<TeamDocType, { updated_at: string; id: string }> | null =
    null;
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
    }, "teams");
  }

  async function start() {
    if (import.meta.server) return;

    const requestFetch = useRequestFetch();
    const nuxtApp = useNuxtApp();
    const db = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useTeamSync] No RxDB");
      return;
    }
    if (!db.teams) {
      console.warn("[useTeamSync] No collection");
      return;
    }
    const activeId = workspaceId();
    if (!activeId) {
      console.warn("[useTeamSync] No wsId");
      return;
    }

    console.log(`[useTeamSync] Starting, workspace=${activeId}`);
    const existingCount = await db.teams.count().exec();
    console.log(`[useTeamSync] Existing docs: ${existingCount}`);

    replicationState = replicateRxCollection<TeamDocType, { updated_at: string; id: string }>({
      replicationIdentifier: `teams-ws-${activeId}`,
      collection: db.teams,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) return { documents: [], checkpoint: undefined };
          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            const localCount = await db.teams.count().exec();
            if (localCount > 0) params.set("checkpoint", JSON.stringify(checkpoint));
          }
          console.log(`[useTeamSync] Pull`, { checkpoint, batchSize });
          const result = await requestFetch(`/api/replication/teams/pull?${params}`);
          const docs = (result as any)?.documents ?? [];
          console.log(`[useTeamSync] Pull returned ${docs.length} docs`);
          return result as any;
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            console.warn("[useTeamSync] Push no wsId");
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
            console.log(`[useTeamSync] Skipping ${skipped} stale row(s) from other workspaces`);
          }
          if (filtered.length === 0) return [];

          console.log(`[useTeamSync] Push ${filtered.length} row(s)`);
          filtered.forEach((r) =>
            console.log(
              `[useTeamSync]   Push:`,
              r.newDocumentState
                ? JSON.stringify({
                    id: r.newDocumentState.id,
                    workspace_id: (r.newDocumentState as any).workspace_id,
                  }).slice(0, 200)
                : "deleted",
            ),
          );
          const result = await requestFetch(`/api/replication/teams/push?workspace_id=${id}`, {
            method: "POST",
            body: filtered,
          });
          console.log(`[useTeamSync] Push done, ${(result as any[])?.length ?? 0} results`);
          return result as TeamDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const subActive = replicationState.active$.subscribe((a) =>
      console.log(`[useTeamSync] Active:`, a),
    );
    cleanupFns.push(() => subActive.unsubscribe());
    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useTeamSync] ❌`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());
    const subCancel = replicationState.canceled$.subscribe((c) =>
      console.log(`[useTeamSync] Canceled:`, c),
    );
    cleanupFns.push(() => subCancel.unsubscribe());
    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
    console.log(`[useTeamSync] Started`);
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    realtimeChannel = supabase
      .channel("app_team_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_team",
        },
        (payload) => {
          console.log("[rxdb-debug] Realtime channel fired for app_team", payload);
          scheduleReSync();
        },
      )
      .subscribe((status) => {
        console.log("[rxdb-debug] Realtime channel subscribe status (teams):", status);
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

    const timer = debounceTimers.get("teams");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("teams");
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
