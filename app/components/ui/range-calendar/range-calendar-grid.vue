<script lang="ts" setup>
import type { RangeCalendarGridProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaRangeCalendarGrid, useForwardProps } from "reka-ui";

const props = defineProps<RangeCalendarGridProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RekaRangeCalendarGrid
    data-slot="range-calendar-grid"
    :class="cn('w-full border-collapse space-x-1', props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </RekaRangeCalendarGrid>
</template>
