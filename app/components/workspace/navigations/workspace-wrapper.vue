<script setup lang="ts">
import WorkspaceInfo from "./workspace-info.vue";
import WorkspaceNavCommunication from "./workspace-nav-communication.vue";
import WorkspaceNavMenu from "./workspace-nav-menu.vue";
import WorkspaceNavOther from "./workspace-nav-other.vue";
</script>

<template>
  <div class="flex h-full w-64 shrink-0 flex-col border-r px-2 text-primary">
    <WorkspaceInfo />
    <div
      class="group/scroll h-full scrollbar-thin [scrollbar-color:transparent_transparent] overflow-x-hidden overflow-y-auto py-2 pr-1 hover:[scrollbar-color:var(--color-gray-300)_transparent] dark:hover:[scrollbar-color:var(--color-neutral-600)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <WorkspaceNavMenu />
      <WorkspaceNavCommunication />
      <WorkspaceNavOther />
    </div>
  </div>
</template>
