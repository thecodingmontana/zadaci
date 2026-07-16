<script setup lang="ts">
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";
</script>

<template>
  <ActionTooltip label="Create Workspace">
    <button class="group flex cursor-pointer items-center">
      <div
        class="mx-3 flex size-10 items-center justify-center overflow-hidden rounded-md bg-brand transition-all group-hover:bg-brand-secondary/90"
      >
        <Icon name="hugeicons:add-01" class="text-white transition" />
      </div>
    </button>
  </ActionTooltip>
</template>
