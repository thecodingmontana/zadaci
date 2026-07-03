<script setup lang="ts">
import type {
  DropdownMenuRadioGroupEmits,
  DropdownMenuRadioGroupProps,
} from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<DropdownMenuRadioGroupProps>();
const emits = defineEmits<DropdownMenuRadioGroupEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuRadioGroup
    data-slot="dropdown-menu-radio-group"
    v-bind="forwarded"
  >
    <slot />
  </DropdownMenuRadioGroup>
</template>
