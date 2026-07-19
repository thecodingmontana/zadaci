import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const config = useRuntimeConfig();
  const url = config.public.supabase.url as string;
  const anonKey = config.public.supabase.anonKey as string;
  if (!url || !anonKey) return null;
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

// Shared reactive state per workspace — all composable instances share the same ref
const sharedState = new Map<string, Ref<Set<string>>>();

export function useWorkspacePresence(workspaceId: () => string | undefined) {
  const { user } = useUserSession();
  const id = computed(() => workspaceId());

  // Each instance gets its own ref synchronised with the shared ref via watcher
  const onlineUserIds = ref<Set<string>>(new Set());

  function start() {
    if (import.meta.server) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const wsId = id.value;
    if (!wsId || !user.value?.id) return;

    // If a shared ref already exists, sync this instance to it
    if (sharedState.has(wsId)) {
      console.log(`[presence] workspace=${wsId} — reusing existing channel`);
      const shared = sharedState.get(wsId)!;
      watch(
        shared,
        (val) => {
          onlineUserIds.value = new Set(val);
        },
        { immediate: true },
      );
      return;
    }

    console.log(`[presence] workspace=${wsId} user=${user.value.id} — creating new channel`);
    const thisRef = ref<Set<string>>(new Set());
    sharedState.set(wsId, thisRef);
    watch(
      thisRef,
      (val) => {
        onlineUserIds.value = new Set(val);
      },
      { immediate: true },
    );

    const channel = supabase.channel(`presence:workspace:${wsId}`, {
      config: { presence: { key: user.value.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const userIds = new Set<string>();
        for (const key of Object.keys(state)) {
          userIds.add(key);
        }
        console.log(`[presence] workspace=${wsId} — sync:`, Array.from(userIds));
        thisRef.value = userIds;
      })
      .on("presence", { event: "join" }, ({ key }) => {
        console.log(`[presence] workspace=${wsId} — join:`, key);
        const next = new Set(thisRef.value);
        next.add(key);
        thisRef.value = next;
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        console.log(`[presence] workspace=${wsId} — leave:`, key);
        const next = new Set(thisRef.value);
        next.delete(key);
        thisRef.value = next;
      })
      .subscribe(async (status) => {
        console.log(`[presence] workspace=${wsId} — subscribe status:`, status);
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
          console.log(`[presence] workspace=${wsId} — tracked user=${user.value.id}`);
        }
      });
  }

  function stop() {
    const wsId = id.value;
    if (!wsId) return;
    console.log(`[presence] workspace=${wsId} — stop (no-op, channel shared)`);
  }

  onUnmounted(() => {
    stop();
  });

  return { start, stop, onlineUserIds };
}
