<script setup lang="ts">
import type { Component } from "vue";
import type { ToastData, ToastType } from "../../lib/toast";
import { Check, Diamond, Loader, TriangleAlert } from "@lucide/vue";
import { AnimatePresence, motion } from "motion-v";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import PixelTimer from "./pixel-timer.vue";

const props = defineProps<{
  t: ToastData;
  layout: Layout;
  paused: boolean;
  reduce: boolean;
  isBottom: boolean;
}>();

const emit = defineEmits<{ height: [id: number, h: number]; close: [] }>();

const EASE = [0.23, 1, 0.32, 1] as const;

const LOOK: Record<ToastType, { tint: string; deep: string; accent: string }> = {
  success: { tint: "#5BD79C", deep: "#22A56E", accent: "#48CE8D" },
  error: { tint: "#F5897F", deep: "#DA463A", accent: "#F0736A" },
  info: { tint: "#93B9FF", deep: "#5B84E6", accent: "#93B9FF" },
  pending: { tint: "#8C8C84", deep: "#5C5C55", accent: "#A2A29A" },
};

const ICON: Record<ToastType, Component> = {
  success: Check,
  error: TriangleAlert,
  info: Diamond,
  pending: Loader,
};

export interface Layout {
  ty: number;
  s: number;
  o: number;
  contentShown: boolean;
  z: number;
}

const measure = ref<HTMLElement | null>(null);
let ro: ResizeObserver | null = null;

onMounted(() => {
  const el = measure.value;
  if (!el) return;
  const report = () => emit("height", props.t.id, el.offsetHeight);
  report();
  ro = new ResizeObserver(report);
  ro.observe(el);
});
onUnmounted(() => ro?.disconnect());

// Fallback plain setTimeout dismiss when animations are off (mirrors the React version)
let fallbackTimer: number | undefined;
watch(
  () => [props.reduce, props.t.type, props.t.duration] as const,
  () => {
    window.clearTimeout(fallbackTimer);
    if (!props.reduce || props.t.type === "pending" || !props.t.duration) return;
    fallbackTimer = window.setTimeout(emit, props.t.duration, "close");
  },
  { immediate: true },
);
onUnmounted(() => window.clearTimeout(fallbackTimer));

const timed = computed(() => props.t.type !== "pending" && !!props.t.duration);
const l = computed(() => LOOK[props.t.type]);
const Icon = computed(() => ICON[props.t.type]);

function onAction() {
  props.t.action?.onClick?.();
  emit("close");
}
</script>

<template>
  <motion.div
    class="absolute inset-x-0"
    :class="isBottom ? 'bottom-0' : 'top-0'"
    :style="{ zIndex: layout.z, transformOrigin: isBottom ? '50% 100%' : '50% 0%' }"
    :initial="
      reduce
        ? { opacity: 0 }
        : { opacity: 0, y: layout.ty + (isBottom ? 26 : -26), scale: 0.9, filter: 'blur(8px)' }
    "
    :animate="
      reduce
        ? { opacity: layout.o }
        : { opacity: layout.o, y: layout.ty, scale: layout.s, filter: 'blur(0px)' }
    "
    :exit="
      reduce
        ? { opacity: 0 }
        : { opacity: 0, y: layout.ty + (isBottom ? 12 : -12), scale: 0.92, filter: 'blur(6px)' }
    "
    :transition="{ duration: 0.34, ease: EASE }"
  >
    <div ref="measure">
      <div
        class="rounded-[18px] p-1.25"
        :style="{ background: 'var(--tst-bezel)', boxShadow: 'var(--tst-bezel-shadow)' }"
      >
        <div
          class="relative overflow-hidden rounded-[14px]"
          :style="{ background: 'var(--tst-panel)', boxShadow: 'var(--tst-panel-inset)' }"
        >
          <div
            class="flex items-stretch transition-opacity duration-200"
            :style="{
              opacity: layout.contentShown ? 1 : 0,
              pointerEvents: layout.contentShown ? 'auto' : 'none',
            }"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3 p-3">
              <span class="relative">
                <AnimatePresence mode="wait" :initial="false">
                  <motion.span
                    :key="t.type"
                    :initial="reduce ? false : { opacity: 0, scale: 0.5 }"
                    :animate="{ opacity: 1, scale: 1 }"
                    :exit="reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }"
                    :transition="{ duration: 0.22, ease: EASE }"
                    class="block"
                  >
                    <span aria-hidden class="grid size-7.5 shrink-0 place-items-center">
                      <component
                        :is="Icon"
                        :size="t.type === 'info' ? 17 : 19"
                        :stroke-width="t.type === 'info' ? 2.6 : 2.5"
                        :color="l.accent"
                        :class="t.type === 'pending' && !reduce ? 'tst-spin' : undefined"
                        v-bind="t.type === 'info' ? { fill: `${l.accent}33` } : {}"
                      />
                    </span>
                  </motion.span>
                </AnimatePresence>
              </span>

              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-[13px] leading-tight font-medium"
                  :style="{ color: 'var(--tst-text)' }"
                >
                  {{ t.title }}
                </p>
                <p
                  v-if="t.desc"
                  class="mt-0.5 truncate text-[11px] leading-tight"
                  :style="{ color: 'var(--tst-mute)' }"
                >
                  {{ t.desc }}
                </p>
              </div>

              <button
                aria-label="Dismiss"
                class="mt-px grid size-6 shrink-0 place-items-center rounded-[7px] text-[13px] leading-none transition-[color,transform] duration-100 outline-none hover:text-(--tst-mute) active:scale-90 motion-reduce:active:scale-100"
                :style="{ color: 'var(--tst-faint)' }"
                @click="emit('close')"
              >
                ✕
              </button>
            </div>

            <button
              v-if="t.action"
              class="flex shrink-0 items-center gap-1.5 px-4 text-[11.5px] font-medium transition-[background-color,transform] duration-100 outline-none hover:[background:var(--tst-well)] active:scale-[0.98] motion-reduce:active:scale-100"
              :style="{
                color: 'var(--tst-text)',
                borderLeft: '1px solid var(--tst-line)',
                background: 'transparent',
              }"
              @click="onAction"
            >
              <component
                :is="t.action.icon"
                v-if="t.action.icon"
                :size="14"
                :stroke-width="2.3"
                :color="l.accent"
              />
              {{ t.action.label }}
            </button>
          </div>

          <div
            v-if="timed"
            class="transition-opacity duration-200"
            :style="{ opacity: layout.contentShown ? 1 : 0 }"
          >
            <PixelTimer
              :key="t.duration"
              :type="t.type"
              :duration="t.duration"
              :paused="paused"
              :reduce="reduce"
              @done="emit('close')"
            />
          </div>
        </div>
      </div>
    </div>
  </motion.div>
</template>
