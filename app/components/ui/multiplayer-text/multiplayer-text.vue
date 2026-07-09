<script setup lang="ts">
import { motion } from "motion-v";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useReducedMotion } from "~/lib/use-reduce-motion";

export interface MultiplayerTextPlayer {
  name: string;
  color: string;
}

const props = withDefaults(
  defineProps<{
    text: string;
    players?: MultiplayerTextPlayer[];
    interval?: number;
    scatter?: boolean;
    class?: string;
  }>(),
  {
    players: () => [
      { name: "Mira", color: "#3ecf8e" },
      { name: "Jonas", color: "#f0883e" },
      { name: "Ada", color: "#22d3ee" },
    ],
    interval: 1400,
    scatter: true,
  },
);
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const SPRING = { type: "spring", duration: 0.5, bounce: 0.16 };
const DROP = { type: "spring", duration: 0.55, bounce: 0.28 };

const TRAVEL_S = 0.65;
const PRESS_MS = 170;

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const HAND_POINT =
  "M9 14 L9 4 A2.5 2.5 0 0 1 14 4 L14 12 L16 12 A6 6 0 0 1 22 18 L22 20 A7 7 0 0 1 15 27 L13 27 A8 8 0 0 1 5 19 L5 17.5 A4 4 0 0 1 9 14 Z";
const HAND_PRESS =
  "M9 14 L9 10.5 A2.5 2.5 0 0 1 14 10.5 L14 12 L16 12 A6 6 0 0 1 22 18 L22 20 A7 7 0 0 1 15 27 L13 27 A8 8 0 0 1 5 19 L5 17.5 A4 4 0 0 1 9 14 Z";

const reduce = useReducedMotion();
const words = computed(() => props.text.split(/\s+/).filter(Boolean));

const containerRef = ref<HTMLElement | null>(null);
const wordRefs = ref<(HTMLElement | null)[]>([]);
const centers = ref<{ x: number; y: number; bottom: number }[]>([]);
const size = ref({ w: 0, h: 0 });
const targets = ref<number[]>([]);

const ready = ref(false);
const inView = ref(false);
const cursors = ref<({ x: number; y: number; rot: number } | null)[]>(
  props.players.map(() => null),
);
const owners = ref<(number | null)[]>([]);
const pressed = ref<{ player: number; word: number } | null>(null);

function setWordRef(el: any, i: number) {
  wordRefs.value[i] = el as HTMLElement | null;
}

let ro: ResizeObserver | null = null;
let io: IntersectionObserver | null = null;
const timers: ReturnType<typeof setTimeout>[] = [];

function measure() {
  const el = containerRef.value;
  if (!el) return;
  const crect = el.getBoundingClientRect();
  size.value = { w: crect.width, h: crect.height };
  centers.value = wordRefs.value.slice(0, words.value.length).map((w) => {
    if (!w) {
      return { x: crect.width / 2, y: crect.height / 2, bottom: crect.height / 2 };
    }
    const r = w.getBoundingClientRect();
    return {
      x: r.left - crect.left + r.width / 2,
      y: r.top - crect.top + r.height / 2,
      bottom: r.bottom - crect.top,
    };
  });
  ready.value = true;
}

onMounted(() => {
  const el = containerRef.value;
  if (!el) return;

  measure();
  ro = new ResizeObserver(measure);
  ro.observe(el);

  io = new IntersectionObserver(
    ([entry]) => {
      inView.value = entry?.isIntersecting ?? false;
    },
    { threshold: 0.3 },
  );
  io.observe(el);
});

onUnmounted(() => {
  ro?.disconnect();
  io?.disconnect();
  timers.forEach(clearTimeout);
});

watch(
  () => props.text,
  () => {
    owners.value = [];
  },
);

// Initial placement (or fixed placement for reduced motion)
watch(
  [ready, () => props.players],
  () => {
    if (!ready.value) return;
    const ps = props.players;
    const count = Math.max(words.value.length, 1);

    if (reduce.value) {
      const claimed: (number | null)[] = words.value.map(() => null);
      cursors.value = ps.map((_, i) => {
        const wi = Math.floor(seeded(i * 7.31 + 3) * count) % count;
        claimed[wi] = i;
        const c = centers.value[wi];
        return c
          ? {
              x: c.x - 11 + (seeded(i * 3 + 2) - 0.5) * 16,
              y: c.bottom + 6,
              rot: (seeded(i + 53) - 0.5) * 20,
            }
          : null;
      });
      owners.value = claimed;
      return;
    }

    if (cursors.value.some(Boolean)) return;

    cursors.value = ps.map((_, i) => {
      if (i === ps.length - 1) {
        const c = centers.value[words.value.length - 1];
        if (c) {
          const topEdge = 2 * c.y - c.bottom;
          return {
            x: c.x - 11 + (seeded(i * 3 + 2) - 0.5) * 16,
            y: topEdge - 52,
            rot: (seeded(i + 41) - 0.5) * 20,
          };
        }
      }
      return {
        x: size.value.w * (0.12 + 0.76 * seeded(i * 9.7 + 5)),
        y: size.value.h * (0.86 + 0.1 * seeded(i * 4.3 + 7)),
        rot: (seeded(i + 41) - 0.5) * 20,
      };
    });
  },
  { immediate: true },
);

// Choreography loop
watch(
  [ready, inView, reduce],
  (_, __, onCleanup) => {
    if (!ready.value || !inView.value || reduce.value) return;
    const count = words.value.length;
    if (count === 0) return;

    let cancelled = false;
    let step = 0;
    const beat = Math.max(props.interval, 900);
    const localTimers: ReturnType<typeof setTimeout>[] = [];

    const tick = () => {
      if (cancelled) return;
      const p = step % props.players.length;
      const taken = new Set(targets.value);
      let wi = Math.floor(seeded(step * 7.31 + 3) * count) % count;
      for (let tries = 0; tries < count && taken.has(wi); tries += 1) {
        wi = (wi + 1) % count;
      }
      const prevWord = targets.value[p];
      targets.value[p] = wi;
      if (prevWord !== undefined) {
        if (owners.value[prevWord] === p) {
          const next = [...owners.value];
          next[prevWord] = null;
          owners.value = next;
        }
      }
      const s = step;
      const c = centers.value[wi];
      if (c) {
        const dx = (seeded(s * 3.7 + 17) - 0.5) * 22;
        const dy = seeded(s * 5.3 + 29) * 6;
        const rot = (seeded(s * 2.9 + 53) - 0.5) * 26;
        const next = [...cursors.value];
        next[p] = { x: c.x - 11 + dx, y: c.bottom + 4 + dy, rot };
        cursors.value = next;

        localTimers.push(
          setTimeout(() => {
            if (cancelled) return;
            pressed.value = { player: p, word: wi };
            const nextOwners = words.value.map((_w, i) => owners.value[i] ?? null);
            nextOwners[wi] = p;
            owners.value = nextOwners;

            localTimers.push(
              setTimeout(() => {
                if (!cancelled) pressed.value = null;
              }, PRESS_MS),
            );
          }, TRAVEL_S * 1000),
        );
      }
      step += 1;
      localTimers.push(setTimeout(tick, beat));
    };

    localTimers.push(setTimeout(tick, 400));

    onCleanup(() => {
      cancelled = true;
      localTimers.forEach(clearTimeout);
    });
  },
  { immediate: true },
);

function wordAnimate(i: number) {
  const isPressed = pressed.value?.word === i;
  const baseRot = props.scatter ? (seeded(i * 1.7 + 13) - 0.5) * 6 : 0;
  const baseY = props.scatter ? (seeded(i * 2.9 + 31) - 0.5) * 0.3 : 0;

  if (reduce.value) {
    return { rotate: baseRot, y: `${baseY}em` };
  }
  return {
    scale: isPressed ? 0.88 : 1,
    rotate: isPressed ? baseRot - 5 : baseRot,
    y: isPressed ? `${baseY + 0.08}em` : `${baseY}em`,
  };
}

function wordTransition(i: number) {
  return pressed.value?.word === i ? { duration: 0.09, ease: EASE_OUT } : DROP;
}

function wordStyle(i: number) {
  const owner = owners.value[i] ?? null;
  return {
    color: owner !== null ? props.players[owner]?.color : undefined,
    transitionDuration: owner !== null ? "150ms" : "500ms",
  };
}
</script>

<template>
  <div ref="containerRef" class="relative" :class="props.class">
    <p class="text-balance">
      <template v-for="(word, i) in words" :key="i">
        <motion.span
          :ref="(el: any) => setWordRef(el?.$el ?? el, i)"
          class="inline-block whitespace-pre transition-colors"
          :style="wordStyle(i)"
          :animate="wordAnimate(i)"
          :transition="wordTransition(i)"
        >
          {{ word }} </motion.span
        ><template v-if="i < words.length - 1">{{ " " }}</template>
      </template>
    </p>

    <div aria-hidden class="pointer-events-none absolute inset-0 select-none">
      <motion.div
        v-for="(pl, i) in players"
        :key="pl.name + i"
        class="absolute top-0 left-0"
        :initial="false"
        :animate="{
          transform: cursors[i]
            ? `translate3d(${cursors[i]!.x}px, ${cursors[i]!.y}px, 0)`
            : 'translate3d(-48px, -48px, 0)',
          opacity: cursors[i] ? 1 : 0,
        }"
        :transition="
          reduce
            ? { duration: 0 }
            : {
                transform: { duration: TRAVEL_S, ease: EASE_IN_OUT },
                opacity: { duration: 0.3, ease: EASE_OUT, delay: i * 0.06 },
              }
        "
      >
        <motion.span
          class="block origin-[11px_6px] filter-[drop-shadow(0_1px_1px_rgba(0,0,0,0.3))_drop-shadow(0_4px_8px_rgba(0,0,0,0.2))]"
          :animate="{
            scale: pressed?.player === i && !reduce ? 0.9 : 1,
            rotate: cursors[i]?.rot ?? 0,
          }"
          :transition="pressed?.player === i ? { duration: 0.09, ease: EASE_OUT } : SPRING"
        >
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden>
            <path
              :d="pressed?.player === i && !reduce ? HAND_PRESS : HAND_POINT"
              :fill="pl.color"
              stroke="#141612"
              stroke-width="1.75"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <path
              d="M12 17.5v4 M15 17.5v4 M18 17.5v4"
              stroke="#141612"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </motion.span>
        <span
          class="absolute top-6.5 left-4.5 rounded-full border-[1.5px] border-[#141612] px-2.5 py-0.5 text-[12px] font-bold tracking-[-0.01em] whitespace-nowrap text-[#141612] shadow-[0_2px_6px_-1px_rgba(0,0,0,0.25)]"
          :style="{ backgroundColor: pl.color }"
        >
          {{ pl.name }}
        </span>
      </motion.div>
    </div>
  </div>
</template>
