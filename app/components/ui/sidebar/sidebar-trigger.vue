<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { useSidebar } from "./utils";

const _props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { toggleSidebar: _toggleSidebar } = useSidebar();
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="cn('h-7 w-7', props.class)"
    @click="_toggleSidebar"
  >
    <PanelLeft />
    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
