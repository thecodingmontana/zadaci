<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { PaginationRootEmits, PaginationRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  PaginationRootProps & {
    class?: HTMLAttributes["class"];
  }
>();
const emits = defineEmits<PaginationRootEmits>();

const delegatedProps = reactiveOmit(props, "class");
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <PaginationRoot
    v-slot="slotProps"
    data-slot="pagination"
    v-bind="forwarded"
    :class="cn('mx-auto flex w-full justify-center', props.class)"
  >
    <slot v-bind="slotProps" />
  </PaginationRoot>
</template>
