<script setup lang="ts">
import type { DropdownMenuGroupProps } from "reka-ui";

const _props = defineProps<DropdownMenuGroupProps>();
</script>

<template>
  <DropdownMenuGroup
    data-slot="dropdown-menu-group"
    v-bind="props"
  >
    <slot />
  </DropdownMenuGroup>
</template>
