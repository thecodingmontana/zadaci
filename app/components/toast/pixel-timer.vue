<script setup lang="ts">
import type { ToastType } from "../../lib/toast";
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  type: ToastType;
  duration: number;
  paused: boolean;
  reduce: boolean;
}>();
const emit = defineEmits<{ done: [] }>();

const LOOK: Record<ToastType, { tint: string; deep: string; accent: string }> = {
  success: { tint: "#5BD79C", deep: "#22A56E", accent: "#48CE8D" },
  error: { tint: "#F5897F", deep: "#DA463A", accent: "#F0736A" },
  info: { tint: "#93B9FF", deep: "#5B84E6", accent: "#93B9FF" },
  pending: { tint: "#8C8C84", deep: "#5C5C55", accent: "#A2A29A" },
};

const PX_COLS = 36;
const PX_ROWS = 2;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function ramp(a: string, b: string, t: number, k: number) {
  const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = A.map((v, i) => clamp((v + (B[i]! - v) * t) * k, 0, 255) | 0);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function jitter(r: number, c: number) {
  const h = ((r * 73856093) ^ (c * 19349663)) >>> 0;
  return (h % 1000) / 1000;
}

const spent = ref(0);
const l = LOOK[props.type];

onMounted(() => {
  if (props.reduce) return;
  let raf = 0;
  let prev = performance.now();
  let elapsed = 0;
  let stopped = false;

  const loop = (now: number) => {
    if (stopped) return;
    const dt = now - prev;
    prev = now;
    if (!props.paused) elapsed += dt;
    const p = Math.min(1, elapsed / props.duration);
    const s = Math.floor(p * PX_COLS);
    if (spent.value !== s) spent.value = s;
    if (p >= 1) {
      emit("done");
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  onUnmounted(() => {
    stopped = true;
    cancelAnimationFrame(raf);
  });
});

function cellStyle(r: number, c: number) {
  const on = c >= spent.value;
  const t = c / (PX_COLS - 1);
  const j = jitter(r, c);
  return on
    ? { background: ramp(l.deep, l.tint, t, 0.68 + 0.52 * j), opacity: 0.6 + 0.4 * j }
    : { background: "var(--tst-px-off)", opacity: 0.5 + 0.5 * j };
}

const rows = Array.from({ length: PX_ROWS }, (_, r) => r);
const cols = Array.from({ length: PX_COLS }, (_, c) => c);
</script>

<template>
  <div
    aria-hidden
    class="grid gap-0.5 px-3 pt-0.5 pb-2.5"
    :style="{ gridTemplateColumns: `repeat(${PX_COLS}, minmax(0, 1fr))`, gridAutoRows: '3.5px' }"
  >
    <template v-for="r in rows" :key="r">
      <span
        v-for="c in cols"
        :key="`${r}-${c}`"
        class="h-[3.5px] rounded-[1px]"
        :style="cellStyle(r, c)"
      />
    </template>
  </div>
</template>
