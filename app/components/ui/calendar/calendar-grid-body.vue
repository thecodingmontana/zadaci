<script lang="ts" setup>
import type { CalendarGridBodyProps } from "reka-ui";

const _props = defineProps<CalendarGridBodyProps>();
</script>

<template>
  <CalendarGridBody
    data-slot="calendar-grid-body"
    v-bind="props"
  >
    <slot />
  </CalendarGridBody>
</template>
