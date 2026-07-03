<script lang="ts" setup>
import { reactiveOmit } from "@vueuse/core";
import type { RangeCalendarHeaderProps } from "reka-ui";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  RangeCalendarHeaderProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RangeCalendarHeader
    data-slot="range-calendar-header"
    :class="cn('flex justify-center pt-1 relative items-center w-full', props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </RangeCalendarHeader>
</template>
