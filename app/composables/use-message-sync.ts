import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { MessageDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import { createClient } from "@supabase/supabase-js";

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

export function useMessageSync(channelId: () => string | undefined) {
  let replicationState: RxReplicationState<
    MessageDocType,
    { updated_at: string; id: string }
  > | null = null;
  let realtimeChannel: RealtimeChannel | null = null;
  let cleanupFns: (() => void)[] = [];
  const isActive = ref(false);
  const syncError = ref<Error | null>(null);
  const realtimeStatus = ref<string>("idle");

  console.log("[useMessageSync] REGISTERING onUnmounted", import.meta.server ? "SERVER" : "CLIENT");
  onUnmounted(() => {
    console.log("[useMessageSync] onUnmounted FIRED");
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

    const _requestFetch = useRequestFetch();

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

    console.log(`[useMessageSync] Rep ID would be: ${repId}`);
    isActive.value = true;
  }

  function _setupRealtimeChannel() {
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

  function _setupVisibilityListener() {
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
