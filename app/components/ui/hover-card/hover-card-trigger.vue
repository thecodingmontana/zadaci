<script setup lang="ts">
import type { HoverCardTriggerProps } from "reka-ui";
import { RekaHoverCardTrigger } from "reka-ui";

const props = defineProps<HoverCardTriggerProps>();
</script>

<template>
  <RekaHoverCardTrigger data-slot="hover-card-trigger" v-bind="props">
    <slot />
  </RekaHoverCardTrigger>
</template>
