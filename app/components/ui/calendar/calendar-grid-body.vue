<script lang="ts" setup>
import type { CalendarGridBodyProps } from "reka-ui";
import { RekaCalendarGridBody } from "reka-ui";

const props = defineProps<CalendarGridBodyProps>();
</script>

<template>
  <RekaCalendarGridBody data-slot="calendar-grid-body" v-bind="props">
    <slot />
  </RekaCalendarGridBody>
</template>
