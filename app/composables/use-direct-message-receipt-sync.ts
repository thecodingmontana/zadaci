import type { RxReplicationState } from "rxdb/plugins/replication";
import type { DirectMessageReceiptDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { replicateRxCollection } from "rxdb/plugins/replication";

export function useDirectMessageReceiptSync(conversationId: () => string | undefined) {
  let replicationState: RxReplicationState<
    DirectMessageReceiptDocType,
    { updated_at: string; id: string }
  > | null = null;
  const isActive = ref(false);

  onUnmounted(() => stop());

  async function start() {
    if (import.meta.server) return;

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) return;

    const collection = db.direct_message_receipts;
    if (!collection) return;

    const convId = conversationId();
    if (!convId) return;

    replicationState = replicateRxCollection({
      replicationIdentifier: `dm-receipts-${convId}`,
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

          const result = await $fetch(
            `/api/replication/direct-message-receipts/pull?${params.toString()}`,
          );
          return result as {
            documents: DirectMessageReceiptDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = conversationId();
          if (!id) return [];

          const filtered = rows.filter((r) => r.newDocumentState);
          if (filtered.length === 0) return [];

          try {
            return await $fetch(
              `/api/replication/direct-message-receipts/push?workspace_id=${id}`,
              {
                method: "POST",
                body: filtered,
              },
            );
          } catch {
            throw new Error("DM receipt push failed");
          }
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    isActive.value = true;
  }

  function stop() {
    if (replicationState) {
      replicationState.cancel();
      replicationState = null;
    }
    isActive.value = false;
  }

  return { start, stop, isActive };
}
