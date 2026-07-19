import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { MessageReceiptDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useMessageReceiptSync(channelId: () => string | undefined) {
  let replicationState: RxReplicationState<
    MessageReceiptDocType,
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
    }, "message_receipts");
  }

  async function start() {
    if (import.meta.server) {
      return;
    }

    const requestFetch = useRequestFetch();

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useMessageReceiptSync] No RxDB instance — aborting");
      return;
    }

    const collection = db.message_receipts;
    if (!collection) {
      console.warn("[useMessageReceiptSync] message_receipts collection not found — aborting");
      return;
    }

    const activeId = channelId();
    if (!activeId) {
      console.warn("[useMessageReceiptSync] No channelId — aborting");
      return;
    }

    const repId = `message-receipts-ch-${activeId}`;

    const existingCount = await collection.count().exec();
    console.log(`[useMessageReceiptSync] Existing local docs: ${existingCount}`);

    replicationState = replicateRxCollection<
      MessageReceiptDocType,
      { updated_at: string; id: string }
    >({
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

          const result = await requestFetch(
            `/api/replication/message-receipts/pull?${params.toString()}`,
          );
          return result as {
            documents: MessageReceiptDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = channelId();
          if (!id) {
            console.warn("[useMessageReceiptSync] Push — no channel id");
            return [];
          }

          const filtered = rows.filter((r) => r.newDocumentState);
          if (filtered.length === 0) return [];

          const result = await requestFetch(
            `/api/replication/message-receipts/push?channel_id=${id}`,
            {
              method: "POST",
              body: filtered,
            },
          );
          return result as MessageReceiptDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const subActive = replicationState.active$.subscribe((active) => {
      console.log(`[useMessageReceiptSync] Replication active:`, active);
    });
    cleanupFns.push(() => subActive.unsubscribe());

    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useMessageReceiptSync] Error:`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());

    const subCancel = replicationState.canceled$.subscribe((canceled) => {
      console.log(`[useMessageReceiptSync] Replication canceled:`, canceled);
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
      .channel("app_message_receipt_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_message_receipt",
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

    const timer = debounceTimers.get("message_receipts");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("message_receipts");
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
