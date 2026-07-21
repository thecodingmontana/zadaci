import type { RxReplicationState } from "rxdb/plugins/replication";
import type { CommentDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { replicateRxCollection } from "rxdb/plugins/replication";

export function useCommentSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    CommentDocType,
    { updated_at: string; id: string }
  > | null = null;
  const isActive = ref(false);

  onUnmounted(() => stop());

  async function start() {
    if (import.meta.server) return;

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) return;

    const collection = db.comments;
    if (!collection) return;

    const wsId = workspaceId();
    if (!wsId) return;

    replicationState = replicateRxCollection({
      replicationIdentifier: `comments-ws-${wsId}`,
      collection,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) return { documents: [], checkpoint: undefined };

          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            const localCount = await collection.count().exec();
            if (localCount > 0) params.set("checkpoint", JSON.stringify(checkpoint));
          }

          const result = await $fetch(`/api/replication/comments/pull?${params.toString()}`);
          return JSON.parse(JSON.stringify(result)) as {
            documents: CommentDocType[];
            checkpoint: { updated_at: string; id: string } | undefined;
          };
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) return [];

          const filtered = rows.filter((r) => r.newDocumentState);
          if (filtered.length === 0) return [];

          try {
            const result = await $fetch(`/api/replication/comments/push?workspace_id=${id}`, {
              method: "POST",
              body: filtered,
            });
            return JSON.parse(JSON.stringify(result)) as CommentDocType[];
          } catch {
            throw new Error("Comment push failed");
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
