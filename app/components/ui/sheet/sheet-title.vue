<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { DialogTitleProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <DialogTitle
    data-slot="sheet-title"
    :class="cn('font-semibold text-foreground', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogTitle>
</template>
