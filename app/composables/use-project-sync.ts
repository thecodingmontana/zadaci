import type { RxReplicationState } from "rxdb/plugins/replication";
import type { ProjectDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { replicateRxCollection } from "rxdb/plugins/replication";

export function useProjectSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    ProjectDocType,
    { updated_at: string; id: string }
  > | null = null;
  let cleanupFns: (() => void)[] = [];
  const isActive = ref(false);
  const syncError = ref<Error | null>(null);

  onUnmounted(() => {
    stop();
  });

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

    isActive.value = true;
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

    isActive.value = false;
  }

  return {
    start,
    stop,
    isActive,
    syncError,
  };
}
