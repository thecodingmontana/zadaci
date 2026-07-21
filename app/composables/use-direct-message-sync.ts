import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { DirectMessageDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useDirectMessageSync(
  conversationId: () => string | undefined,
  pendingIds?: { add: (id: string) => void; remove: (id: string) => void },
) {
  let replicationState: RxReplicationState<
    DirectMessageDocType,
    { updated_at: string; id: string }
  > | null = null;
  let realtimeChannel: RealtimeChannel | null = null;
  let cleanupFns: (() => void)[] = [];
  const isActive = ref(false);

  onUnmounted(() => stop());

  function scheduleReSync() {
    debounceReSync(() => {
      if (replicationState) replicationState.reSync();
    }, "direct-messages");
  }

  async function start() {
    if (import.meta.server) return;

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) return;

    const collection = db.direct_messages;
    if (!collection) return;

    const convId = conversationId();
    if (!convId) return;

    replicationState = replicateRxCollection({
      replicationIdentifier: `dm-${convId}`,
      collection,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = conversationId();
          if (!id) return { documents: [], checkpoint: undefined };

          const params = new URLSearchParams();
          params.set("conversation_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            const localCount = await collection.count().exec();
            if (localCount > 0) params.set("checkpoint", JSON.stringify(checkpoint));
          }

          const result = await $fetch(`/api/replication/direct-messages/pull?${params.toString()}`);
          return JSON.parse(JSON.stringify(result)) as {
            documents: DirectMessageDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = conversationId();
          if (!id) return [];

          const filtered = rows.filter(
            (r) => r.newDocumentState && r.newDocumentState.conversation_id === id,
          );
          if (filtered.length === 0) return [];

          try {
            const result = await $fetch(
              `/api/replication/direct-messages/push?conversation_id=${id}`,
              {
                method: "POST",
                body: filtered,
              },
            );
            for (const row of filtered) {
              const docId = row.newDocumentState!.id;
              if (docId) pendingIds?.remove(docId);
            }
            return JSON.parse(JSON.stringify(result)) as DirectMessageDocType[];
          } catch {
            throw new Error("DM push failed");
          }
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    setupRealtimeChannel();
    isActive.value = true;
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) return;

    realtimeChannel = supabase
      .channel("app_direct_message_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_direct_message" }, () => {
        scheduleReSync();
      })
      .subscribe();

    cleanupFns.push(() => {
      if (realtimeChannel) {
        const client = getSupabase();
        if (client) client.removeChannel(realtimeChannel);
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

    const timer = debounceTimers.get("direct-messages");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("direct-messages");
    }

    if (realtimeChannel) {
      const client = getSupabase();
      if (client) client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    isActive.value = false;
  }

  return { start, stop, isActive };
}
