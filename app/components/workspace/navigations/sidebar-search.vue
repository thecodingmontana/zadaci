<script setup lang="ts">
import CommandMenu from "~/components/ui/command-menu/command-menu.vue";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const { commandMenuOpen, commandGroups, onCommandRun } = useWorkspaceSearch(workspaceId);
</script>

<template>
  <button
    type="button"
    class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
    @click="commandMenuOpen = true"
  >
    <Icon name="lucide:search" size="14" />
    <span class="flex-1 text-left text-xs">Search...</span>
    <span class="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
      <kbd class="rounded border px-1 font-mono">⌘</kbd>
      <kbd class="rounded border px-1 font-mono">K</kbd>
    </span>
  </button>

  <CommandMenu
    v-model:open="commandMenuOpen"
    :groups="commandGroups"
    hotkey=""
    @run="onCommandRun"
  />
</template>
