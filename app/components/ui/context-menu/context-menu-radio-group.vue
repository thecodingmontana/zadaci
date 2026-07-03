<script setup lang="ts">
import type {
  ContextMenuRadioGroupEmits,
  ContextMenuRadioGroupProps,
} from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<ContextMenuRadioGroupProps>();
const emits = defineEmits<ContextMenuRadioGroupEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ContextMenuRadioGroup
    data-slot="context-menu-radio-group"
    v-bind="forwarded"
  >
    <slot />
  </ContextMenuRadioGroup>
</template>
