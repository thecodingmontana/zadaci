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
  let stopTypingTimer: ReturnType<typeof setTimeout> | null = null;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  let activeRoomId = "";

  function sendStopTyping(roomId: string, memberId: string) {
    if (channel?.state !== "joined") return;
    channel.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { memberId },
    });
  }

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
        names.value = Array.from(map.entries())
          .filter(([key]) => !key.startsWith("__ts__"))
          .map(([_, value]) => value)
          .filter(Boolean);
        console.log(
          `[typing] typingNames updated — roomId:${roomId} names:`,
          names.value,
          `map:`,
          Array.from(map.entries()),
        );
      },
      { immediate: true },
    );
    return names;
  }

  function start(roomId: string) {
    console.log(`[typing] start() called — roomId:${roomId} active:${activeRoomId}`);
    if (import.meta.server) return;
    const supabase = getSupabase();
    if (!supabase || !roomId || activeRoomId === roomId) {
      console.log(
        `[typing] start() skipped — supabase:${!!supabase} roomId:${!!roomId} same:${activeRoomId === roomId}`,
      );
      return;
    }

    stop();
    activeRoomId = roomId;

    if (!sharedTyping.has(roomId)) {
      sharedTyping.set(roomId, ref(new Map<string, string>()));
    }

    channel = supabase.channel(`typing:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    channel.on("broadcast", { event: "typing" }, (msg: any) => {
      const { memberId, memberName } = msg?.payload ?? msg;
      console.log(
        `[typing] broadcast received — memberId:${memberId} memberName:${memberName} roomId:${roomId} raw:`,
        msg,
      );
      if (!memberId) return;
      const mapRef = sharedTyping.get(roomId);
      if (!mapRef) return;
      const next = new Map(mapRef.value);
      next.set(memberId, memberName);
      next.set(`__ts__${memberId}`, String(Date.now()));
      mapRef.value = next;
    });

    channel.on("broadcast", { event: "stop_typing" }, (msg: any) => {
      const { memberId } = msg?.payload ?? msg;
      console.log(`[typing] stop_typing received — memberId:${memberId} roomId:${roomId}`);
      if (!memberId) return;
      const mapRef = sharedTyping.get(roomId);
      if (!mapRef) return;
      const next = new Map(mapRef.value);
      next.delete(memberId);
      next.delete(`__ts__${memberId}`);
      mapRef.value = next;
    });

    channel.subscribe((status: string) => {
      console.log(`[typing] channel subscribe status — roomId:${roomId} status:${status}`);
    });

    sweepTimer = setInterval(() => {
      const mapRef = sharedTyping.get(roomId);
      if (!mapRef) return;
      const now = Date.now();
      const next = new Map(mapRef.value);
      let changed = false;
      for (const [id] of next) {
        if (!id || !id.startsWith("__ts__")) {
          const ts = next.get(`__ts__${id}`);
          if (ts && now - parseInt(ts, 10) > TYPING_TIMEOUT) {
            console.log(`[typing] sweep expired — id:${id} roomId:${roomId}`);
            next.delete(id);
            next.delete(`__ts__${id}`);
            changed = true;
          }
        }
      }
      if (changed) mapRef.value = next;
    }, SWEEP_INTERVAL);

    cleanupFns.push(() => {
      if (stopTypingTimer) {
        clearTimeout(stopTypingTimer);
        stopTypingTimer = null;
      }
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

    if (stopTypingTimer) clearTimeout(stopTypingTimer);
    stopTypingTimer = setTimeout(() => {
      sendStopTyping(roomId, memberId);
      stopTypingTimer = null;
    }, 2500);

    if (now - lastBroadcast < BROADCAST_DEBOUNCE) {
      console.log(
        `[typing] broadcastTyping debounced — roomId:${roomId} memberId:${memberId} since:${now - lastBroadcast}ms`,
      );
      return;
    }
    lastBroadcast = now;

    const supabase = getSupabase();
    if (!supabase || !roomId || !memberId) {
      console.log(
        `[typing] broadcastTyping skipped — supabase:${!!supabase} roomId:${!!roomId} memberId:${!!memberId}`,
      );
      return;
    }

    if (!sharedTyping.has(roomId)) {
      sharedTyping.set(roomId, ref(new Map<string, string>()));
    }

    const mapRef = sharedTyping.get(roomId)!;
    const next = new Map(mapRef.value);
    next.set(`__ts__${memberId}`, String(now));
    mapRef.value = next;

    if (channel?.state === "joined") {
      console.log(
        `[typing] sending broadcast — roomId:${roomId} memberId:${memberId} memberName:${memberName}`,
      );
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { memberId, memberName },
      });
    } else {
      console.log(`[typing] channel not joined — state:${channel?.state} roomId:${roomId}`);
    }
  }

  return { start, stop, broadcastTyping, typingNames };
}
