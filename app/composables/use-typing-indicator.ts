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

const TYPING_TIMEOUT = 4000;
const BROADCAST_DEBOUNCE = 3000;
const SWEEP_INTERVAL = 1000;

const sharedTyping = new Map<string, Ref<Map<string, string>>>();

export function useTypingIndicator() {
  let channel: any = null;
  let cleanupFns: (() => void)[] = [];
  let lastBroadcast = 0;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  let activeRoomId = "";

  onUnmounted(() => stop());

  function typingNames(roomId: string): Ref<string[]> {
    if (!sharedTyping.has(roomId)) {
      sharedTyping.set(roomId, ref(new Map<string, string>()));
    }
    const mapRef = sharedTyping.get(roomId)!;
    const names = ref<string[]>([]);
    watch(
      mapRef,
      (map) => {
        names.value = Array.from(map.values()).filter(Boolean);
      },
      { immediate: true },
    );
    return names;
  }

  function start(roomId: string) {
    if (import.meta.server) return;
    const supabase = getSupabase();
    if (!supabase || !roomId || activeRoomId === roomId) return;

    stop();
    activeRoomId = roomId;

    if (!sharedTyping.has(roomId)) {
      sharedTyping.set(roomId, ref(new Map<string, string>()));
    }

    channel = supabase.channel(`typing:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    channel.on("broadcast", { event: "typing" }, (payload: any) => {
      const { memberId, memberName } = payload;
      const mapRef = sharedTyping.get(roomId);
      if (!mapRef) return;
      const next = new Map(mapRef.value);
      next.set(memberId, memberName);
      next.set(`__ts__${memberId}`, String(Date.now()));
      mapRef.value = next;
    });

    channel.subscribe();

    sweepTimer = setInterval(() => {
      const mapRef = sharedTyping.get(roomId);
      if (!mapRef) return;
      const now = Date.now();
      const next = new Map(mapRef.value);
      let changed = false;
      for (const [id] of next) {
        if (!id.startsWith("__ts__")) {
          const ts = next.get(`__ts__${id}`);
          if (ts && now - parseInt(ts, 10) > TYPING_TIMEOUT) {
            next.delete(id);
            next.delete(`__ts__${id}`);
            changed = true;
          }
        }
      }
      if (changed) mapRef.value = next;
    }, SWEEP_INTERVAL);

    cleanupFns.push(() => {
      if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      activeRoomId = "";
    });
  }

  function stop() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
  }

  function broadcastTyping(roomId: string, memberId: string, memberName: string) {
    const now = Date.now();
    if (now - lastBroadcast < BROADCAST_DEBOUNCE) return;
    lastBroadcast = now;

    const supabase = getSupabase();
    if (!supabase || !roomId || !memberId) return;

    if (!sharedTyping.has(roomId)) {
      sharedTyping.set(roomId, ref(new Map<string, string>()));
    }

    const mapRef = sharedTyping.get(roomId)!;
    const next = new Map(mapRef.value);
    next.set(`__ts__${memberId}`, String(now));
    mapRef.value = next;

    if (channel?.state === "joined") {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { memberId, memberName },
      });
    }
  }

  return { start, stop, broadcastTyping, typingNames };
}
