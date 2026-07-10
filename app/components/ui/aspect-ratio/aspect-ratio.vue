<script setup lang="ts">
import type { AspectRatioProps } from "reka-ui";
import { AspectRatio as RekaAspectRatio } from "reka-ui";

const props = defineProps<AspectRatioProps>();
</script>

<template>
  <RekaAspectRatio v-slot="slotProps" data-slot="aspect-ratio" v-bind="props">
    <slot v-bind="slotProps" />
  </RekaAspectRatio>
</template>
