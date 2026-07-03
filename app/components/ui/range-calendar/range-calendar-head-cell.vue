<script lang="ts" setup>
import { reactiveOmit } from "@vueuse/core";
import type { RangeCalendarHeadCellProps } from "reka-ui";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  RangeCalendarHeadCellProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarHeadCell
    data-slot="range-calendar-head-cell"
    :class="cn('w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground', props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </RangeCalendarHeadCell>
</template>
