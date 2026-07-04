<script lang="ts" setup>
import type { DrawerDescriptionProps } from "vaul-vue";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";

const props = defineProps<DrawerDescriptionProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <DrawerDescription
    data-slot="drawer-description"
    v-bind="delegatedProps"
    :class="cn('text-sm text-muted-foreground', props.class)"
  >
    <slot />
  </DrawerDescription>
</template>
