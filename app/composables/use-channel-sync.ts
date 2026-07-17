import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { ChannelDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useChannelSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    ChannelDocType,
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
    }, "channels");
  }

  async function start() {
    if (import.meta.server) {
      return;
    }

    const requestFetch = useRequestFetch();

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useChannelSync] No RxDB instance — aborting");
      return;
    }

    const collection = db.channels;
    if (!collection) {
      console.warn("[useChannelSync] channels collection not found — aborting");
      return;
    }

    const activeId = workspaceId();
    if (!activeId) {
      console.warn("[useChannelSync] No workspaceId — aborting");
      return;
    }

    const repId = `channels-ws-${activeId}`;
    console.log(`[useChannelSync] Starting sync, workspace=${activeId}`);

    const existingCount = await collection.count().exec();
    console.log(`[useChannelSync] Existing local docs: ${existingCount}`);

    replicationState = replicateRxCollection<ChannelDocType, { updated_at: string; id: string }>({
      replicationIdentifier: repId,
      collection,
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
            const localCount = await collection.count().exec();
            if (localCount > 0) {
              params.set("checkpoint", JSON.stringify(checkpoint));
            }
          }

          console.log(`[useChannelSync] Pull — checkpoint:`, checkpoint, `batchSize:`, batchSize);
          const result = await requestFetch(`/api/replication/channels/pull?${params.toString()}`);
          const docs = (result as any)?.documents ?? [];
          console.log(`[useChannelSync] Pull returned ${docs.length} documents`);
          return result as {
            documents: ChannelDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            console.warn("[useChannelSync] Push — no workspace id");
            return [];
          }

          // Skip deletion events — caused by useClearRxDb clearing the database
          // on workspace switch. Pushing them to the wrong workspace causes 403
          // errors that block the entire replication.
          const filtered = rows.filter((r) => {
            if (!r.newDocumentState) return false;
            const wsId = (r.newDocumentState as any).workspace_id;
            // Allow docs without workspace_id (junction tables) or matching workspace
            return wsId === undefined || wsId === id;
          });
          const skipped = rows.length - filtered.length;
          if (skipped > 0) {
            console.log(`[useChannelSync] Skipping ${skipped} stale row(s) from other workspaces`);
          }
          if (filtered.length === 0) return [];

          console.log(`[useChannelSync] Push — ${filtered.length} row(s)`);
          filtered.forEach((r) => {
            console.log(
              `[useChannelSync]   Push doc:`,
              r.newDocumentState
                ? JSON.stringify({
                    id: r.newDocumentState.id,
                    workspace_id: (r.newDocumentState as any).workspace_id,
                  }).slice(0, 200)
                : "deleted",
            );
          });

          const result = await requestFetch(`/api/replication/channels/push?workspace_id=${id}`, {
            method: "POST",
            body: filtered,
          });
          console.log(`[useChannelSync] Push completed, ${(result as any[])?.length ?? 0} results`);
          return result as ChannelDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    replicationState.active$.subscribe((active) => {
      console.log(`[useChannelSync] Replication active:`, active);
    });

    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useChannelSync] ❌ Error:`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());

    const subCancel = replicationState.canceled$.subscribe((canceled) => {
      console.log(`[useChannelSync] Replication canceled:`, canceled);
    });
    cleanupFns.push(() => subCancel.unsubscribe());

    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
    console.log(`[useChannelSync] Sync started`);
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    realtimeChannel = supabase
      .channel("app_channel_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_channel",
        },
        () => {
          scheduleReSync();
        },
      )
      .subscribe((status) => {
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

    const timer = debounceTimers.get("channels");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("channels");
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
