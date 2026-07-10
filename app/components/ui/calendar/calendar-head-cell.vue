<script lang="ts" setup>
import type { CalendarHeadCellProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaCalendarHeadCell, useForwardProps } from "reka-ui";

const props = defineProps<CalendarHeadCellProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RekaCalendarHeadCell
    data-slot="calendar-head-cell"
    :class="cn('flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground', props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </RekaCalendarHeadCell>
</template>
