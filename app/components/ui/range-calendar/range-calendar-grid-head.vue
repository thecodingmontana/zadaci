<script lang="ts" setup>
import type { RangeCalendarGridHeadProps } from "reka-ui";

const _props = defineProps<RangeCalendarGridHeadProps>();
</script>

<template>
  <RangeCalendarGridHead
    data-slot="range-calendar-grid-head"
    v-bind="props"
  >
    <slot />
  </RangeCalendarGridHead>
</template>
