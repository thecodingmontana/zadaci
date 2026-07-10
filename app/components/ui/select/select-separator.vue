<script setup lang="ts">
import type { SelectSeparatorProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaSelectSeparator } from "reka-ui";

const props = defineProps<SelectSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <RekaSelectSeparator
    data-slot="select-separator"
    v-bind="delegatedProps"
    :class="cn('pointer-events-none -mx-1 my-1 h-px bg-border', props.class)"
  />
</template>
