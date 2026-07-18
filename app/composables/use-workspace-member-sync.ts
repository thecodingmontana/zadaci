import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { WorkspaceMemberDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

export function useWorkspaceMemberSync(workspaceId: () => string | undefined) {
  let replicationState: RxReplicationState<
    WorkspaceMemberDocType,
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
      replicationState?.reSync();
    }, "workspace_members");
  }

  async function start() {
    if (import.meta.server) return;
    const requestFetch = useRequestFetch();
    const nuxtApp = useNuxtApp();
    const db = (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
    if (!db) {
      console.warn("[useWsMemberSync] No RxDB");
      return;
    }
    if (!db.workspace_members) {
      console.warn("[useWsMemberSync] No collection");
      return;
    }
    const activeId = workspaceId();
    if (!activeId) {
      console.warn("[useWsMemberSync] No wsId");
      return;
    }

    console.log(`[useWsMemberSync] Starting, workspace=${activeId}`);
    const existingCount = await db.workspace_members.count().exec();
    console.log(`[useWsMemberSync] Existing docs: ${existingCount}`);

    replicationState = replicateRxCollection({
      replicationIdentifier: `workspace-members-ws-${activeId}`,
      collection: db.workspace_members,
      pull: {
        handler: async (checkpoint, batchSize) => {
          const id = workspaceId();
          if (!id) return { documents: [], checkpoint: undefined };
          const params = new URLSearchParams();
          params.set("workspace_id", id);
          params.set("batch_size", String(batchSize || 50));
          if (checkpoint) {
            const localCount = await db.workspace_members.count().exec();
            if (localCount > 0) params.set("checkpoint", JSON.stringify(checkpoint));
          }
          console.log(`[useWsMemberSync] Pull`, { checkpoint, batchSize });
          const result = await requestFetch(`/api/replication/workspace-members/pull?${params}`);
          const docs = (result as any)?.documents ?? [];
          console.log(`[useWsMemberSync] Pull returned ${docs.length} docs`);
          return result as any;
        },
        batchSize: 50,
      },
      push: {
        handler: async (rows) => {
          const id = workspaceId();
          if (!id) {
            console.warn("[useWsMemberSync] Push no wsId");
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
            console.log(`[useWsMemberSync] Skipping ${skipped} stale row(s) from other workspaces`);
          }
          if (filtered.length === 0) return [];

          console.log(`[useWsMemberSync] Push ${filtered.length} row(s)`);
          filtered.forEach((r) =>
            console.log(
              `[useWsMemberSync]   Push:`,
              r.newDocumentState
                ? JSON.stringify({ id: r.newDocumentState.id }).slice(0, 200)
                : "deleted",
            ),
          );
          const result = await requestFetch(
            `/api/replication/workspace-members/push?workspace_id=${id}`,
            { method: "POST", body: filtered },
          );
          console.log(`[useWsMemberSync] Push done, ${(result as any[])?.length ?? 0} results`);
          return result as WorkspaceMemberDocType[];
        },
        batchSize: 50,
      },
      live: true,
      autoStart: true,
      retryTime: 5000,
    });

    const subActive = replicationState.active$.subscribe((a) =>
      console.log(`[useWsMemberSync] Active:`, a),
    );
    cleanupFns.push(() => subActive.unsubscribe());
    const subErr = replicationState.error$.subscribe((err) => {
      console.error(`[useWsMemberSync] ❌`, err?.message || err);
      syncError.value = err;
    });
    cleanupFns.push(() => subErr.unsubscribe());
    const subCancel = replicationState.canceled$.subscribe((c) =>
      console.log(`[useWsMemberSync] Canceled:`, c),
    );
    cleanupFns.push(() => subCancel.unsubscribe());
    setupRealtimeChannel();
    setupVisibilityListener();
    isActive.value = true;
    console.log(`[useWsMemberSync] Started`);
  }

  function setupRealtimeChannel() {
    const supabase = getSupabase();
    if (!supabase) return;
    realtimeChannel = supabase
      .channel("app_workspace_members_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_workspace_members" },
        () => scheduleReSync(),
      )
      .subscribe((status) => {
        realtimeStatus.value = status;
      });
    cleanupFns.push(() => {
      if (realtimeChannel) {
        getSupabase()?.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    });
  }

  function setupVisibilityListener() {
    const handler = () => {
      if (document.visibilityState === "visible") scheduleReSync();
    };
    document.addEventListener("visibilitychange", handler);
    cleanupFns.push(() => document.removeEventListener("visibilitychange", handler));
  }

  function stop() {
    replicationState?.cancel();
    replicationState = null;
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    const timer = debounceTimers.get("workspace_members");
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete("workspace_members");
    }
    if (realtimeChannel) {
      getSupabase()?.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    isActive.value = false;
  }

  return { start, stop, isActive, syncError, realtimeStatus };
}
