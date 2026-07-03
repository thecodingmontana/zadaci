<script lang="ts" setup>
import { reactiveOmit } from "@vueuse/core";
import type { DrawerTitleProps } from "vaul-vue";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  DrawerTitleProps & { class?: HTMLAttributes["class"] }
>();

const _delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <DrawerTitle
    data-slot="drawer-title"
    v-bind="delegatedProps"
    :class="cn('text-foreground font-semibold', props.class)"
  >
    <slot />
  </DrawerTitle>
</template>
