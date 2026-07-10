<script lang="ts" setup>
import type { RangeCalendarHeadingProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaRangeCalendarHeading, useForwardProps } from "reka-ui";

const props = defineProps<RangeCalendarHeadingProps & { class?: HTMLAttributes["class"] }>();

defineSlots<{
  default: (props: { headingValue: string }) => any;
}>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RekaRangeCalendarHeading
    v-slot="{ headingValue }"
    data-slot="range-calendar-heading"
    :class="cn('text-sm font-medium', props.class)"
    v-bind="forwardedProps"
  >
    <slot :heading-value>
      {{ headingValue }}
    </slot>
  </RekaRangeCalendarHeading>
</template>
