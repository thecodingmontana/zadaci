const PRESENCE_INTERVAL = 60_000; // heartbeat every 60s

export function useUserPresence() {
  const { user } = useUserSession();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const currentStatus = ref<string>("available");

  async function setStatus(status: string) {
    currentStatus.value = status;
    try {
      await $fetch("/api/user/status", {
        method: "PATCH",
        body: { status },
      });
    } catch {
      // silent — presence tracking should never surface errors to the user
    }
  }

  async function heartbeat() {
    try {
      await $fetch("/api/user/status/heartbeat", {
        method: "POST",
        body: { status: currentStatus.value },
      });
    } catch {
      // silent
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      if (currentStatus.value === "available") {
        setStatus("away");
      }
    } else if (document.visibilityState === "visible") {
      if (currentStatus.value === "away") {
        setStatus("available");
      }
    }
  }

  function onBeforeUnload() {
    navigator.sendBeacon("/api/user/status/heartbeat", JSON.stringify({ status: "offline" }));
  }

  function start() {
    if (import.meta.server || !user.value?.id) return;

    setStatus("available");

    heartbeatTimer = setInterval(heartbeat, PRESENCE_INTERVAL);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
  }

  function stop() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("beforeunload", onBeforeUnload);
  }

  onUnmounted(() => {
    stop();
  });

  return { start, stop, currentStatus };
}
