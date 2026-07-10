import { RekaContextMenuRoot } from "reka-ui";
<script setup lang="ts">
import type { ContextMenuRootEmits, ContextMenuRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<ContextMenuRootProps>();
const emits = defineEmits<ContextMenuRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaContextMenuRoot data-slot="context-menu" v-bind="forwarded">
    <slot />
  </RekaContextMenuRoot>
</template>
