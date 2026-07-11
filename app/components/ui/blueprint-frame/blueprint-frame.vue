<script setup lang="ts">
import { computed } from "vue";
import { Avatar, AvatarImage } from "~/components/ui/avatar";

const props = withDefaults(
  defineProps<{
    color?: string;
    inset?: number;
    speed?: number;
    mask?: boolean;
    class?: string;
  }>(),
  {
    color: "#ffffff",
    inset: 48,
    speed: 1,
    mask: false,
  },
);

const EO = "cubic-bezier(0.23, 1, 0.32, 1)";

const HATCH =
  "repeating-linear-gradient(-63deg, color-mix(in srgb, var(--bp) 12%, transparent) 0, color-mix(in srgb, var(--bp) 12%, transparent) 1px, transparent 1px, transparent 14px)";

const CSS = `
@keyframes bp-draw-y { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes bp-draw-x { from { clip-path: inset(0 50% 0 50%); } to { clip-path: inset(0 0 0 0); } }
@keyframes bp-band-in { from { opacity: 0; filter: blur(5px); } to { opacity: 1; filter: blur(0); } }
@keyframes bp-cross-in { from { opacity: 0; transform: translate(-50%,-50%) scale(0.5); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
@keyframes bp-drift { to { background-position: 12.5px -6.4px; } }
@keyframes bp-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .bp-anim, .bp-cross { animation: bp-fade 260ms ease both !important; clip-path: none !important; filter: none !important; }
  .bp-cross { transform: translate(-50%, -50%) !important; }
}
`;

const frozen = computed(() => props.speed <= 0);
const driftDur = computed(() => (frozen.value ? 0 : 7 / props.speed));
const line = "color-mix(in srgb, var(--bp) 10%, transparent)";

const bandH = 72;
const gap = 40;
const topTopY = `${gap}px`;
const topBotY = `${gap + bandH}px`;
const botTopY = `calc(100% - ${gap + bandH}px)`;
const botBotY = `calc(100% - ${gap}px)`;

const leftX = computed(() => ({ left: `${props.inset}px` }));
const rightX = computed(() => ({ left: `calc(100% - ${props.inset}px)` }));

const bands = [
  { top: topTopY, height: bandH },
  { top: `calc(100% - ${gap + bandH}px)`, height: bandH },
];
const rules = [topTopY, topBotY, botTopY, botBotY];

const crosses = computed(() => [
  { x: leftX.value, y: topTopY },
  { x: rightX.value, y: topTopY },
  { x: leftX.value, y: topBotY },
  { x: rightX.value, y: topBotY },
  { x: leftX.value, y: botTopY },
  { x: rightX.value, y: botTopY },
  { x: leftX.value, y: botBotY },
  { x: rightX.value, y: botBotY },
]);

const rootStyle = computed(() => ({ "--bp": props.color }));
const styleTag = "style";
</script>

<template>
  <div
    aria-hidden
    class="pointer-events-none absolute inset-0 overflow-hidden select-none"
    :class="[
      mask && 'mask-[radial-gradient(ellipse_94%_100%_at_50%_46%,black_44%,transparent_98%)]',
      props.class,
    ]"
    :style="rootStyle"
  >
    <div class="pointer-events-auto absolute right-0 bottom-0 left-0 grid place-content-center">
      <div class="flex items-center gap-x-1">
        <p>&copy; {{ new Date().getFullYear() }} &middot; Made with 💚,</p>
        <NuxtLink
          to="https://x.com/@codewithmontana"
          target="_blank"
          class="group flex cursor-pointer items-center gap-x-1"
        >
          <Avatar class="size-6">
            <AvatarImage
              src="https://avatars.githubusercontent.com/u/63234437?v=4"
              alt="Edo avatar"
            />
          </Avatar>
          <p class="decoration-brand decoration-wavy group-hover:hover:underline">
            @codewithmontana
          </p>
        </NuxtLink>
      </div>
    </div>
    <component :is="styleTag">{{ CSS }}</component>

    <div
      class="bp-anim absolute inset-y-0 w-px"
      :style="{ left: `${inset}px`, background: line, animation: `bp-draw-y 720ms ${EO} both` }"
    />
    <div
      class="bp-anim absolute inset-y-0 w-px"
      :style="{
        left: `calc(100% - ${inset}px)`,
        background: line,
        animation: `bp-draw-y 720ms ${EO} 90ms both`,
      }"
    />

    <div
      v-for="(b, i) in bands"
      :key="`band-${i}`"
      class="bp-anim absolute overflow-hidden"
      :style="{
        left: `${inset}px`,
        right: `${inset}px`,
        top: b.top,
        height: `${b.height}px`,
        backgroundImage: HATCH,
        animation: `bp-band-in 700ms ${EO} 340ms both${frozen ? '' : `, bp-drift ${driftDur}s linear 1040ms infinite`}`,
      }"
    />

    <div
      v-for="(y, i) in rules"
      :key="`rule-${i}`"
      class="bp-anim absolute inset-x-0 h-px"
      :style="{
        top: y,
        background: line,
        animation: `bp-draw-x 620ms ${EO} ${240 + i * 70}ms both`,
      }"
    />

    <div
      v-for="(c, i) in crosses"
      :key="`cross-${i}`"
      class="bp-cross absolute h-3.5 w-3.5"
      :style="{
        ...c.x,
        top: c.y,
        transform: 'translate(-50%, -50%)',
        animation: `bp-cross-in 450ms ${EO} ${720 + i * 45}ms both`,
      }"
    >
      <span
        class="absolute top-0 left-1/2 h-full w-px -translate-x-1/2"
        :style="{ background: 'color-mix(in srgb, var(--bp) 50%, transparent)' }"
      />
      <span
        class="absolute top-1/2 left-0 h-px w-full -translate-y-1/2"
        :style="{ background: 'color-mix(in srgb, var(--bp) 50%, transparent)' }"
      />
    </div>
  </div>
</template>
