<script setup lang="ts">
import type { Layout } from "./toast-card.vue";
import type { ToastData, ToastPosition } from "~/lib/toast";
import { AnimatePresence } from "motion-v";
import { computed, reactive, ref, watch } from "vue";
import { toast } from "~/lib/toast";
import ToastCard from "./toast-card.vue";

const props = defineProps<{
  toasts: ToastData[];
  position: ToastPosition;
  reduce: boolean;
}>();

const expanded = ref(false);
const heights = reactive<Record<number, number>>({});

const GAP = 12;
const PEEK = 15;

const isBottom = computed(() => props.position.startsWith("bottom"));

function onHeight(id: number, h: number) {
  if (heights[id] !== h) heights[id] = h;
}

watch(
  () => props.toasts.length,
  (len) => {
    if (len <= 1 && expanded.value) expanded.value = false;
  },
);

const frontH = computed(() => {
  const id = props.toasts[0]?.id;
  return id !== undefined ? (heights[id] ?? 78) : 78;
});

const layouts = computed<Layout[]>(() => {
  let acc = 0;
  const dir = isBottom.value ? -1 : 1;
  return props.toasts.map((t, i) => {
    const h = heights[t.id] ?? 78;
    const expandedY = acc;
    acc += h + GAP;
    const depth = Math.min(i, 2);
    return {
      ty: expanded.value ? dir * expandedY : dir * depth * PEEK,
      s: expanded.value ? 1 : 1 - depth * 0.05,
      o: expanded.value ? 1 : i < 3 ? 1 : 0,
      contentShown: expanded.value || i === 0,
      z: 100 - i,
    };
  });
});

const wrapH = computed(() => {
  let acc = 0;
  for (const t of props.toasts) acc += (heights[t.id] ?? 78) + GAP;
  return expanded.value ? Math.max(acc - GAP, frontH.value) : frontH.value + 2 * PEEK;
});
</script>

<template>
  <div
    class="pointer-events-auto relative w-95 max-w-[calc(100vw-3rem)]"
    :style="{
      height: toasts.length ? `${wrapH}px` : '0px',
      transition: 'height 0.34s cubic-bezier(0.23,1,0.32,1)',
    }"
    @mouseenter="toasts.length > 1 && (expanded = true)"
    @mouseleave="expanded = false"
  >
    <AnimatePresence>
      <ToastCard
        v-for="(t, i) in toasts"
        :key="t.id"
        :t="t"
        :layout="layouts[i]!"
        :paused="expanded"
        :reduce="reduce"
        :is-bottom="isBottom"
        @height="onHeight"
        @close="toast.dismiss(t.id)"
      />
    </AnimatePresence>
  </div>
</template>
