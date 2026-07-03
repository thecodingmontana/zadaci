<script lang="ts" setup>
import { reactiveOmit } from "@vueuse/core";
import type { DrawerDescriptionProps } from "vaul-vue";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  DrawerDescriptionProps & { class?: HTMLAttributes["class"] }
>();

const _delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <DrawerDescription
    data-slot="drawer-description"
    v-bind="delegatedProps"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </DrawerDescription>
</template>
