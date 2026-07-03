<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { AlertDialogCancelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  AlertDialogCancelProps & { class?: HTMLAttributes["class"] }
>();

const _delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <AlertDialogCancel
    v-bind="delegatedProps"
    :class="cn(
      buttonVariants({ variant: 'outline' }),
      'mt-2 sm:mt-0',
      props.class,
    )"
  >
    <slot />
  </AlertDialogCancel>
</template>
