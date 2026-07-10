<script setup lang="ts">
import type { MenubarSubEmits } from "reka-ui";
import { RekaMenubarSub, useForwardPropsEmits } from "reka-ui";

interface MenubarSubRootProps {
  defaultOpen?: boolean;
  open?: boolean;
}

const props = defineProps<MenubarSubRootProps>();
const emits = defineEmits<MenubarSubEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaMenubarSub v-slot="slotProps" data-slot="menubar-sub" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaMenubarSub>
</template>
