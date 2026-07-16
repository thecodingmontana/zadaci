<script setup lang="ts">
import { RotateCw } from "@lucide/vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";
import { useWorkspaces } from "~/composables/use-workspaces";
import { toast } from "~/lib/toast";
import NavigationAction from "./navigation-action.vue";
import NavigationItem from "./navigation-item.vue";
import NavigationUser from "./navigation-user.vue";

const {
  data: workspaces,
  status: workspacesStatus,
  error: workspacesError,
  refetch: refreshWorkspaces,
} = useWorkspaces();

watch(workspacesStatus, (status) => {
  if (status === "error") {
    const errorMessage =
      (workspacesError.value as any)?.data?.message ??
      (workspacesError.value as any)?.data?.statusMessage ??
      workspacesError.value?.message ??
      "Couldn't load your workspaces.";
    toast.error(errorMessage, {
      desc: "Check your connection and try again",
      position: "top-right",
      action: {
        label: "Retry",
        icon: RotateCw,
        onClick: () => refreshWorkspaces(),
      },
    });
  }
});
</script>
<template>
  <aside class="flex h-full w-full flex-col items-center space-y-3 border-r py-3 text-primary">
    <NavigationAction />
    <Separator class="h-0.5 bg-zinc-300 data-[orientation=horizontal]:w-10 dark:bg-zinc-700" />
    <ScrollArea class="w-full flex-1">
      <div
        v-if="workspacesStatus === 'pending' || workspacesStatus === 'error'"
        class="flex flex-col items-center gap-y-4"
      >
        <Skeleton v-for="n in 3" :key="n" class="mx-3 size-12 rounded-2xl" />
      </div>
      <template v-else>
        <div v-for="workspace in workspaces" :key="workspace.id" class="mb-4">
          <NavigationItem
            :id="workspace.id"
            :name="workspace.name"
            :image-url="workspace.imageUrl"
          />
        </div>
      </template>
    </ScrollArea>
    <div class="mt-auto flex flex-col items-center gap-y-2 pb-3">
      <ActionTooltip label="User" align="center" side="right">
        <NavigationUser />
      </ActionTooltip>
    </div>
  </aside>
</template>
