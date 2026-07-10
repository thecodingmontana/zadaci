<script lang="ts" setup>
import type { RangeCalendarGridBodyProps } from "reka-ui";
import { RekaRangeCalendarGridBody } from "reka-ui";

const props = defineProps<RangeCalendarGridBodyProps>();
</script>

<template>
  <RekaRangeCalendarGridBody data-slot="range-calendar-grid-body" v-bind="props">
    <slot />
  </RekaRangeCalendarGridBody>
</template>
