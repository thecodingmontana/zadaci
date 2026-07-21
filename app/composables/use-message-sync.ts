import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { MessageDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useMessageSync(
  channelId: () => string | undefined,
  pendingIds?: { add: (id: string) => void; remove: (id: string) => void },
) {
  let replicationState: RxReplicationState<
    MessageDocType,
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
    }, "messages");
  }

  async function start() {
    if (import.meta.server) {
      return;
    }

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useMessageSync] No RxDB instance — aborting");
      return;
    }

    const collection = db.messages;
    if (!collection) {
      console.warn("[useMessageSync] messages collection not found — aborting");
      return;
    }

    const activeId = channelId();
    if (!activeId) {
      console.warn("[useMessageSync] No channelId — aborting");
      return;
    }

    const repId = `messages-ch-${activeId}`;

    const existingCount = await collection.count().exec();
    console.log(`[useMessageSync] Existing local docs: ${existingCount}`);

    replicationState = replicateRxCollection<MessageDocType, { updated_at: string; id: string }>({
      replicationIdentifier: repId,
      collection,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = channelId();
          if (!id) {
            return { documents: [], checkpoint: undefined };
          }

          const params = new URLSearchParams();
          params.set("channel_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            const localCount = await collection.count().exec();
            if (localCount > 0) {
              params.set("checkpoint", JSON.stringify(checkpoint));
            }
          }

          const result = await $fetch(`/api/replication/messages/pull?${params.toString()}`);
          return result as {
            documents: MessageDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = channelId();
          if (!id) {
            console.warn("[useMessageSync] Push — no channel id");
            return [];
          }

          const filtered = rows.filter(
            (r) => r.newDocumentState && r.newDocumentState.channel_id === id,
          );
          if (filtered.length === 0) return [];

          console.log(`[useMessageSync] Push — ${filtered.length} doc(s) being sent`);
          for (const row of filtered) {
            console.log(`[useMessageSync]   Push doc: ${row.newDocumentState!.id}`);
          }

          try {
            const result = await $fetch(`/api/replication/messages/push?channel_id=${id}`, {
              method: "POST",
              body: filtered,
            });
            console.log(
              `[useMessageSync] Push succeeded, result length: ${(result as any[])?.length ?? 0}`,
            );
            for (const row of filtered) {
              const docId = row.newDocumentState!.id;
              if (docId) pendingIds?.remove(docId);
            }
            return result as MessageDocType[];
          } catch (err: any) {
            console.warn(`[useMessageSync] Push failed:`, err?.message ?? err);
            throw err;
          }
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const subActive = replicationState.active$.subscribe((active) => {
      console.log(`[useMessageSync] Replication active:`, active);
    });
    cleanupFns.push(() => subActive.unsubscribe());

    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useMessageSync] Error:`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());

    const subCancel = replicationState.canceled$.subscribe((canceled) => {
      console.log(`[useMessageSync] Replication canceled:`, canceled);
    });
    cleanupFns.push(() => subCancel.unsubscribe());

    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    realtimeChannel = supabase
      .channel("app_message_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_message",
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

    const timer = debounceTimers.get("messages");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("messages");
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
