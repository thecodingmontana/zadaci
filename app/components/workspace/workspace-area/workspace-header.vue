<script setup lang="ts">
import WorkspaceHeaderMembers from "./workspace-header-members.vue";
import WorkspaceHeaderSearch from "./workspace-header-search.vue";
</script>

<template>
  <div class="flex items-center justify-between gap-4 border-b px-6 py-3">
    <WorkspaceHeaderSearch />

    <div class="flex shrink-0 items-center gap-3">
      <WorkspaceHeaderMembers />
    </div>
  </div>
</template>
