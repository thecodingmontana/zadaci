<script setup lang="ts">
const isVisible = ref(false);

onMounted(() => {
  console.log("[offline] MOUNTED. navigator.onLine:", navigator.onLine);
  console.log(
    "[offline] navigator.connection:",
    JSON.stringify((navigator as any).connection?.type ?? "N/A"),
  );

  if (!navigator.onLine) {
    console.log("[offline] starting offline, showing banner");
    isVisible.value = true;
  }

  window.addEventListener("online", () => {
    console.log("[offline] ONLINE event fired, nav.onLine:", navigator.onLine);
    isVisible.value = false;
  });

  window.addEventListener("offline", () => {
    console.log("[offline] OFFLINE event fired, nav.onLine:", navigator.onLine);
    isVisible.value = true;
  });

  setInterval(() => {
    const nl = navigator.onLine;
    const vis = isVisible.value;
    console.log(
      "[offline] POLL nav.onLine=",
      nl,
      "isVisible=",
      vis,
      "| mismatch:",
      nl === false && vis === false,
    );
    if (nl === false && vis === false) {
      console.log("[offline] POLL FIX: nav.onLine says offline but banner hidden, showing");
      isVisible.value = true;
    }
    if (nl === true && vis === true) {
      console.log(
        "[offline] POLL FIX: nav.onLine says online but banner shown, maybe server down? trying fetch",
      );
      fetch("/api/health", { method: "GET", cache: "no-store" })
        .then((r) => {
          if (r.ok) {
            console.log("[offline] POLL fetch succeeded, hiding banner");
            isVisible.value = false;
          }
        })
        .catch(() => {
          console.log("[offline] POLL fetch failed, staying visible");
        });
    }
  }, 3000);
});
</script>

<template>
  <div
    v-if="isVisible"
    class="relative z-50 flex items-center justify-center gap-2 bg-[#fafafa] px-4 py-2 text-center text-xs font-medium text-black/70 dark:border-white/10 dark:bg-[#111110] dark:text-white/70"
  >
    <Icon name="hugeicons:wifi-off-01" class="shrink-0 text-amber-500" size="16" />
    <span> You're offline — changes will sync automatically when connection returns. </span>
    <button
      type="button"
      aria-label="Dismiss banner"
      class="ml-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
      @click="isVisible = false"
    >
      <Icon name="hugeicons:cancel-01" class="size-3.5" />
    </button>
  </div>
</template>
