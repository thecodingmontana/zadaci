<script lang="ts" setup>
import type { DrawerTitleProps } from "vaul-vue";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DrawerTitle as VaulDrawerTitle } from "vaul-vue";

const props = defineProps<DrawerTitleProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <VaulDrawerTitle
    data-slot="drawer-title"
    v-bind="delegatedProps"
    :class="cn('text-lg leading-none font-semibold tracking-tight', props.class)"
  >
    <slot />
  </VaulDrawerTitle>
</template>
