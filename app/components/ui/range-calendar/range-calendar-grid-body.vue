<script lang="ts" setup>
import type { RangeCalendarGridBodyProps } from "reka-ui";

const _props = defineProps<RangeCalendarGridBodyProps>();
</script>

<template>
  <RangeCalendarGridBody
    data-slot="range-calendar-grid-body"
    v-bind="props"
  >
    <slot />
  </RangeCalendarGridBody>
</template>
