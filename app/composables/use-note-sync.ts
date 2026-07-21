import type { RxReplicationState } from "rxdb/plugins/replication";
import type { NoteDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { replicateRxCollection } from "rxdb/plugins/replication";

export function useNoteSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<NoteDocType, { updated_at: string; id: string }> | null =
    null;
  const isActive = ref(false);

  onUnmounted(() => stop());

  async function start() {
    if (import.meta.server) return;

    const nuxtApp = useNuxtApp();
    const db: ZadaciDatabase | null = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) return;

    const collection = db.notes;
    if (!collection) return;

    const wsId = workspaceId();
    if (!wsId) return;

    replicationState = replicateRxCollection({
      replicationIdentifier: `notes-ws-${wsId}`,
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

          const result = await $fetch(`/api/replication/notes/pull?${params.toString()}`);
          return result as {
            documents: NoteDocType[];
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
            return await $fetch(`/api/replication/notes/push?workspace_id=${id}`, {
              method: "POST",
              body: filtered,
            });
          } catch {
            throw new Error("Note push failed");
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
