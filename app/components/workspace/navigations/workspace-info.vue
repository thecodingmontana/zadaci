<script setup lang="ts">
import type { WorkspaceMemberDocType } from "~/plugins/rxdb.client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

const store = useWorkspaceStore();
const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const db = useRxDb();
const workspace = computed(() => store.activeWorkspace);

const members = ref<WorkspaceMemberDocType[]>([]);
const membersLoaded = ref(false);
let sub: any = null;

watch(
  [() => db?.workspace_members, workspaceId],
  ([col, wsId]) => {
    if (sub) {
      sub.unsubscribe();
      sub = null;
    }
    membersLoaded.value = false;
    if (!col || !wsId) return;
    sub = col.find({ selector: { workspace_id: wsId } }).$.subscribe((docs) => {
      members.value = docs;
      membersLoaded.value = true;
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  if (sub) sub.unsubscribe();
});

const memberCount = computed(() => members.value.length);
const onlineCount = computed(() => members.value.length);

const isOwner = computed(() => workspace.value?.userRole === "OWNER");
const isAdmin = computed(() => isOwner.value || workspace.value?.userRole === "ADMIN");
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        class="flex w-full cursor-pointer items-center gap-x-2 rounded-md py-3 pl-1 text-left transition-colors hover:bg-[#f2f2f2] hover:dark:bg-neutral-800"
      >
        <template v-if="membersLoaded || workspace">
          <Avatar class="size-10 shrink-0 rounded-md">
            <AvatarImage :src="workspace?.imageUrl ?? 'https://github.com/shadcn.png'" />
            <AvatarFallback class="rounded-md">
              {{ workspace?.name?.charAt(0)?.toUpperCase() ?? "W" }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <h2 class="truncate font-semibold text-primary">
              {{ workspace?.name ?? "Workspace" }}
            </h2>
            <div class="flex h-5 items-center space-x-4 font-ibm-plex-mono text-xs">
              <div>Members: {{ memberCount }}</div>
              <Separator orientation="vertical" />
              <div>Online: {{ onlineCount }}</div>
            </div>
          </div>
        </template>
        <template v-else>
          <Skeleton class="size-10 shrink-0 rounded-md" />
          <div class="min-w-0 flex-1 space-y-2">
            <Skeleton class="h-4 w-28" />
            <Skeleton class="h-3 w-20" />
          </div>
        </template>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" side="right" class="w-60">
      <DropdownMenuLabel>{{ workspace?.name ?? "Workspace" }}</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem class="cursor-pointer">
          <Icon name="hugeicons:user-add-01" size="16" />
          <span>Invite People</span>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="isAdmin" class="cursor-pointer">
          <Icon name="hugeicons:user-multiple-02" size="16" />
          <span>Manage Members</span>
        </DropdownMenuItem>

        <DropdownMenuItem class="cursor-pointer">
          <Icon name="hugeicons:task-01" size="16" />
          <span>Add Task</span>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="isAdmin" class="cursor-pointer">
          <Icon name="hugeicons:folder-01" size="16" />
          <span>Add Project</span>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="isAdmin" class="cursor-pointer">
          <Icon name="hugeicons:user-group" size="16" />
          <span>Create Team</span>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="isAdmin" class="cursor-pointer">
          <Icon name="hugeicons:message-multiple-01" size="16" />
          <span>Create Channel</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuItem v-if="isOwner" class="cursor-pointer">
        <Icon name="hugeicons:settings-02" size="16" />
        <span>Workspace Settings</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem v-if="isOwner" class="cursor-pointer text-rose-500">
        <Icon name="hugeicons:delete-01" size="16" />
        <span>Delete Workspace</span>
      </DropdownMenuItem>

      <DropdownMenuItem v-else class="cursor-pointer text-rose-500">
        <Icon name="hugeicons:logout-02" size="16" />
        <span>Leave Workspace</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
