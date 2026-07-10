<script lang="ts" setup>
import type { CalendarGridHeadProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { RekaCalendarGridHead } from "reka-ui";

const props = defineProps<CalendarGridHeadProps & { class?: HTMLAttributes["class"] }>();
</script>

<template>
  <RekaCalendarGridHead data-slot="calendar-grid-head" v-bind="props">
    <slot />
  </RekaCalendarGridHead>
</template>
