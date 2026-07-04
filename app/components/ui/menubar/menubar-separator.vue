<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { MenubarSeparatorProps } from "reka-ui";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<MenubarSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <MenubarSeparator
    data-slot="menubar-separator"
    :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
    v-bind="forwardedProps"
  />
</template>
