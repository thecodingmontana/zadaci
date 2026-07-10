<script lang="ts" setup>
import type { DrawerDescriptionProps } from "vaul-vue";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DrawerDescription as VaulDrawerDescription } from "vaul-vue";

const props = defineProps<DrawerDescriptionProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <VaulDrawerDescription
    data-slot="drawer-description"
    v-bind="delegatedProps"
    :class="cn('text-sm text-muted-foreground', props.class)"
  >
    <slot />
  </VaulDrawerDescription>
</template>
