<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";

const props = withDefaults(
  defineProps<{
    avatars: AvatarItem[];
    max?: number;
    size?: number;
    removable?: boolean;
  }>(),
  {
    max: 5,
    size: 28,
    removable: false,
  },
);

const emit = defineEmits<{
  remove: [item: AvatarItem];
}>();

const PALETTE = ["#f0883e", "#3ecf8e", "#22d3ee", "#b06bff", "#f0463a"];

export interface AvatarItem {
  src?: string;
  name: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const shown = computed(() => props.avatars.slice(0, props.max));
const extra = computed(() => props.avatars.length - shown.value.length);
const overlap = computed(() => props.size * 0.34);
const spread = computed(() => props.size * 0.18);

const hovered = ref(false);
</script>

<template>
  <div class="flex items-center" @mouseenter="hovered = true" @mouseleave="hovered = false">
    <div
      v-for="(a, i) in shown"
      :key="a.name + i"
      class="group/av relative"
      :style="{ zIndex: shown.length - i }"
    >
      <ActionTooltip :label="a.name" side="top">
        <motion.div
          :animate="{
            marginLeft: i === 0 ? 0 : hovered ? -overlap + spread : -overlap,
          }"
          :transition="{ type: 'spring', stiffness: 320, damping: 26 }"
          :while-hover="{ y: -3, zIndex: 50, transition: { duration: 0.18 } }"
          class="relative"
        >
          <Avatar
            class="border-2 border-background"
            :style="{ width: `${size}px`, height: `${size}px` }"
          >
            <AvatarImage v-if="a.src" :src="a.src" :alt="a.name" />
            <AvatarFallback
              class="text-[11px] font-semibold"
              :style="{
                background: PALETTE[hashName(a.name) % PALETTE.length],
                color: '#141612',
                fontSize: `${size * 0.36}px`,
              }"
            >
              {{ initials(a.name) }}
            </AvatarFallback>
          </Avatar>
          <Button
            v-if="removable"
            size="icon"
            variant="destructive"
            class="absolute -top-1 -right-1 z-50 size-5 cursor-pointer rounded-full border-2 border-background p-0.5 opacity-0 transition-opacity group-hover/av:opacity-100"
            @click.stop="emit('remove', a)"
          >
            <Icon name="lucide:x" size="10" />
          </Button>
        </motion.div>
      </ActionTooltip>
    </div>
    <motion.span
      v-if="extra > 0"
      :animate="{ marginLeft: hovered ? -overlap + spread : -overlap }"
      :transition="{ type: 'spring', stiffness: 320, damping: 26 }"
      class="grid place-items-center rounded-full bg-white font-semibold text-neutral-600 ring-2 ring-background dark:bg-[#232320] dark:text-neutral-300"
      :style="{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${size * 0.32}px`,
        zIndex: 0,
      }"
    >
      +{{ extra }}
    </motion.span>
  </div>
</template>
