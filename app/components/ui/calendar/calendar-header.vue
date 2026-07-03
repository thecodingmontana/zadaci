<script lang="ts" setup>
import { reactiveOmit } from "@vueuse/core";
import type { CalendarHeaderProps } from "reka-ui";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  CalendarHeaderProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CalendarHeader
    data-slot="calendar-header"
    :class="cn('flex justify-center pt-1 relative items-center w-full px-8', props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </CalendarHeader>
</template>
