<script setup lang="ts">
import type { Layout } from "./toast-card.vue";
import { AnimatePresence } from "motion-v";
import { computed, reactive, ref, watch } from "vue";
import { getToastState, toast } from "../../lib/toast";
import { useReducedMotion } from "../../lib/use-reduce-motion";
import ToastCard from "./toast-card.vue";

const props = withDefaults(defineProps<{ max?: number; class?: string }>(), { max: 5 });

const state = getToastState();
const reduce = useReducedMotion();
const expanded = ref(false);
const heights = reactive<Record<number, number>>({});

const GAP = 12;
const PEEK = 15;

function onHeight(id: number, h: number) {
  if (heights[id] !== h) heights[id] = h;
}

const visible = computed(() => state.list.slice(0, props.max));

watch(
  () => visible.value.length,
  (len) => {
    if (len <= 1 && expanded.value) expanded.value = false;
  },
);

const frontH = computed(() => {
  const id = visible.value[0]?.id;
  return id !== undefined ? (heights[id] ?? 78) : 78;
});

const layouts = computed<Layout[]>(() => {
  let acc = 0;
  return visible.value.map((t, i) => {
    const h = heights[t.id] ?? 78;
    const expandedY = acc;
    acc += h + GAP;
    const depth = Math.min(i, 2);
    return {
      ty: expanded.value ? expandedY : depth * PEEK,
      s: expanded.value ? 1 : 1 - depth * 0.05,
      o: expanded.value ? 1 : i < 3 ? 1 : 0,
      contentShown: expanded.value || i === 0,
      z: 100 - i,
    };
  });
});

const wrapH = computed(() => {
  let acc = 0;
  for (const t of visible.value) acc += (heights[t.id] ?? 78) + GAP;
  return expanded.value ? Math.max(acc - GAP, frontH.value) : frontH.value + 2 * PEEK;
});
</script>

<template>
  <div
    class="tst-root pointer-events-none fixed inset-0 z-100 flex items-start justify-end p-4 sm:p-6"
    :class="[props.class]"
  >
    <div
      class="pointer-events-auto relative w-95 max-w-[calc(100vw-3rem)]"
      :style="{
        height: visible.length ? `${wrapH}px` : '0px',
        transition: 'height 0.34s cubic-bezier(0.23,1,0.32,1)',
      }"
      @mouseenter="visible.length > 1 && (expanded = true)"
      @mouseleave="expanded = false"
    >
      <AnimatePresence>
        <ToastCard
          v-for="(t, i) in visible"
          :key="t.id"
          :t="t"
          :layout="layouts[i]!"
          :paused="expanded"
          :reduce="reduce"
          @height="onHeight"
          @close="toast.dismiss(t.id)"
        />
      </AnimatePresence>
    </div>
  </div>
</template>
