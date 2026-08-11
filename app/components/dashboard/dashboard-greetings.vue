<script setup lang="ts">
import { format, getHours } from "date-fns";

const { user } = useUserSession();

const clock = ref("");

let clockInterval: ReturnType<typeof setInterval> | undefined;

const timeOfDay = computed(() => {
  const hour = getHours(new Date());
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
});

function updateClock() {
  const now = new Date();
  clock.value = format(now, "hh:mm:ss a");
}

onMounted(() => {
  updateClock();
  clockInterval = setInterval(updateClock, 1000);
});

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
});
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold tracking-tight">
      Good {{ timeOfDay }}, {{ user?.username || "there" }}
    </h1>
    <p class="text-sm text-muted-foreground">{{ format(new Date(), "PPPP") }} at {{ clock }}</p>
  </div>
</template>
