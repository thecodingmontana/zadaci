<script setup lang="ts">
import WorkspaceHeader from "~/components/workspace/workspace-area/workspace-header.vue";
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <WorkspaceHeader />
    <div class="min-h-0 flex-1 overflow-y-auto">
      <slot />
    </div>
  </div>
</template>
