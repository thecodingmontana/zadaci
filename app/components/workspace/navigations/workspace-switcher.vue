<script setup lang="ts">
import type { Workspace } from "~/types";
import { CheckIcon, ChevronsUpDown, Plus } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { useInvalidateSidebarProjects } from "~/composables/use-sidebar-projects";
import { useModalStore } from "~/stores/use-modal-store";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

const props = defineProps<{
  status: string;
  workspaces: Workspace[];
  side?: "right" | "top" | "bottom" | "left";
}>();

const modalStore = useModalStore();
const workspaceStore = useWorkspaceStore();
const invalidateSidebarProjects = useInvalidateSidebarProjects();

const currentActiveWorkspace = computed(() => workspaceStore.activeWorkspace);

async function onSelectActiveWorkspace(w: Workspace) {
  workspaceStore.onSetActiveWorkspace(w);
  workspaceStore?.onSetWorkspaceBreadcrumb({
    name: "Dashboard",
    path: `/workspace/${w.id}/dashboard`,
    children: null,
  });

  await invalidateSidebarProjects(w.id);

  await refreshNuxtData([
    `board_view_projects_${w.id}`,
    `all_project_stats_${w.id}`,
    `mobile_sidebar_projects_${w.id}`,
    `workspace_user_due_items_${w.id}`,
  ]);

  navigateTo(`/workspace/${w.id}/dashboard`);
}

function onCreateWorkspace() {
  modalStore?.onOpen("createWorkspace");
  modalStore?.setIsOpen(true);
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <div v-if="props.status === 'pending'" class="flex items-center gap-2 p-2">
        <Skeleton class="aspect-square size-8 rounded-lg" />
        <div class="grid w-full gap-2 self-start">
          <Skeleton class="h-2.5 w-full rounded" />
          <Skeleton class="h-2.5 w-1/2 rounded" />
        </div>
      </div>
      <Button
        v-else
        variant="ghost"
        class="w-full cursor-pointer px-1 py-3 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground dark:bg-[#1d1d1d]"
      >
        <Avatar class="aspect-square size-8 rounded-lg ring-1 ring-black/5 dark:ring-white/10">
          <AvatarImage
            :src="currentActiveWorkspace?.imageUrl ?? ''"
            :alt="currentActiveWorkspace?.name"
          />
          <AvatarFallback class="rounded-lg">
            {{ currentActiveWorkspace?.name?.slice(0, 2).toUpperCase() ?? "??" }}
          </AvatarFallback>
        </Avatar>
        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-semibold">{{ currentActiveWorkspace?.name }}</span>
          <span class="truncate text-xs text-muted-foreground">Free Plan</span>
        </div>
        <ChevronsUpDown class="ml-auto size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      v-if="status === 'success'"
      class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg dark:bg-[#1d1d1d]"
      :side="props?.side ? props?.side : 'left'"
      :align="props?.side === 'top' ? 'start' : 'end'"
      :side-offset="props?.side === 'top' ? 0 : 6"
    >
      <DropdownMenuLabel class="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="(w, index) in props.workspaces"
        :key="w.id"
        class="flex cursor-pointer items-center justify-between gap-2 p-2 dark:hover:bg-[#343434]"
        @click="onSelectActiveWorkspace(w)"
      >
        <div class="flex items-center gap-2">
          <Avatar class="aspect-square size-6 rounded-sm">
            <AvatarImage :src="w?.imageUrl ?? ''" :alt="w?.name" />
            <AvatarFallback class="rounded-lg text-[10px]">
              {{ w.name?.slice(0, 2).toUpperCase() }}
            </AvatarFallback>
          </Avatar>
          {{ w.name }}
        </div>
        <CheckIcon v-if="currentActiveWorkspace?.id === w.id" class="size-4" />
        <DropdownMenuShortcut v-else>⌘{{ index + 1 }}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="cursor-pointer gap-2 p-2 dark:hover:bg-[#343434]"
        @click="onCreateWorkspace"
      >
        <div class="flex size-6 items-center justify-center rounded-md border bg-background">
          <Plus class="size-4" />
        </div>
        <div class="font-medium text-muted-foreground">Create Workspace</div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
