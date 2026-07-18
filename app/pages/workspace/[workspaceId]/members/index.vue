<script setup lang="ts">
import type { WorkspaceMemberDocType } from "~/plugins/rxdb.client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const store = useWorkspaceStore();
const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const db = useRxDb();
const workspace = computed(() => store.activeWorkspace);

const { canManageMembers } = usePermissions(workspace);

watch(
  [workspace, canManageMembers],
  ([ws, can]) => {
    if (ws && !can) {
      navigateTo(`/workspace/${workspaceId.value}/dashboard`);
    }
  },
  { immediate: true },
);

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
      console.log("[members] workspace members:", docs);
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  if (sub) sub.unsubscribe();
});

const membersTitle = useWorkspacePageTitle("Members");
useSeoMeta({
  title: membersTitle,
  description: "View and manage workspace members and their roles.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <section v-if="canManageMembers" class="space-y-4 p-3">
        <div>
          <h1 class="font-medium">Members Management</h1>
          <p class="max-w-2xl text-sm text-muted-foreground">
            Manage your team members and their account permissions access in the workspace.
          </p>
        </div>

        <div v-if="!membersLoaded" class="space-y-2">
          <div v-for="i in 3" :key="i" class="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton class="size-10 rounded-full" />
            <div class="space-y-1.5">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-20" />
            </div>
          </div>
        </div>

        <div v-else class="grid gap-2">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-3 rounded-lg border p-3"
          >
            <Avatar class="size-10">
              <AvatarImage :src="member.profile_picture_url ?? undefined" :alt="member.username" />
              <AvatarFallback>{{
                member.username?.charAt(0)?.toUpperCase() ?? "?"
              }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ member.username }}</p>
              <p class="text-xs text-muted-foreground">{{ member.role }}</p>
            </div>
          </div>
        </div>
      </section>
    </NuxtLayout>
  </NuxtLayout>
</template>
