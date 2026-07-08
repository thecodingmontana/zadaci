<script setup lang="ts">
import type { ToastData, ToastPosition } from "~/lib/toast";
import { computed } from "vue";
import { getToastState } from "~/lib/toast";
import { useReducedMotion } from "~/lib/use-reduce-motion";
import ToastStack from "./toast-stack.vue";

const props = withDefaults(
  defineProps<{ max?: number; position?: ToastPosition; class?: string }>(),
  { max: 5, position: "bottom-right" },
);

const state = getToastState();
const reduce = useReducedMotion();

const ALL_POSITIONS: ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const groups = computed(() => {
  const g: Partial<Record<ToastPosition, ToastData[]>> = {};
  for (const t of state.list) {
    const pos = t.position ?? props.position;
    (g[pos] ??= []).push(t);
  }
  for (const key of Object.keys(g) as ToastPosition[]) {
    g[key] = g[key]!.slice(0, props.max);
  }
  return g;
});

const activePositions = computed(() =>
  ALL_POSITIONS.filter((p) => (groups.value[p]?.length ?? 0) > 0),
);

function anchorClasses(pos: ToastPosition) {
  const [v, h] = pos.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  const vClass = v === "top" ? "items-start" : "items-end";
  const hClass = h === "left" ? "justify-start" : h === "center" ? "justify-center" : "justify-end";
  return `${vClass} ${hClass}`;
}
</script>

<template>
  <div
    v-for="pos in activePositions"
    :key="pos"
    class="tst-root pointer-events-none fixed inset-0 z-100 flex p-4 sm:p-6"
    :class="[anchorClasses(pos), props.class]"
  >
    <ToastStack :toasts="groups[pos]!" :position="pos" :reduce="reduce" />
  </div>
</template>
