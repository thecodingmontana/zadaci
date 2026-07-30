<script setup lang="ts">
import { Loader } from "@lucide/vue";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const trashTitle = useWorkspacePageTitle("Trash");
useSeoMeta({
  title: trashTitle,
  description: "View and manage trashed items in the workspace.",
});

interface TrashItem {
  id: string;
  entityType: string;
  title: string;
  parentTitle: string | null;
  deletedAt: string;
  updatedAt: string;
}

const items = ref<TrashItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const entityConfig: Record<string, { icon: string; label: string }> = {
  project: { icon: "hugeicons:folder-01", label: "Project" },
  task: { icon: "hugeicons:task-01", label: "Task" },
  channel: { icon: "hugeicons:message-02", label: "Channel" },
  team: { icon: "hugeicons:user-group", label: "Team" },
  tag: { icon: "hugeicons:tag-01", label: "Tag" },
  note: { icon: "hugeicons:note-03", label: "Note" },
  message: { icon: "lucide:message-square", label: "Message" },
  direct_message: { icon: "lucide:message-circle", label: "DM" },
  comment: { icon: "lucide:message-circle", label: "Comment" },
};

// Map entity types to RxDB collection names (Tier 1 only)
const rxCollectionMap: Record<string, string> = {
  project: "projects",
  task: "tasks",
  channel: "channels",
  team: "teams",
  tag: "tags",
  note: "notes",
  message: "messages",
  direct_message: "direct_messages",
  comment: "comments",
};

async function fetchTrash() {
  loading.value = true;
  error.value = null;
  try {
    const data = await $fetch<{ items: TrashItem[] }>(`/api/workspace/${workspaceId.value}/trash`);
    items.value = data.items;
  } catch (err: any) {
    error.value = err?.response?._data?.statusMessage ?? err?.message ?? "Failed to load trash";
  } finally {
    loading.value = false;
  }
}

const activeAction = ref<{ type: "restore" | "permanent"; item: TrashItem } | null>(null);
const isActing = ref(false);

async function patchRxDb(item: TrashItem, patch: Record<string, any>) {
  const db = await useRxDbSafe();
  if (!db) return;
  const colName = rxCollectionMap[item.entityType];
  if (!colName) return;
  const col = (db as any)[colName];
  if (!col) return;
  const doc = await col.findOne(item.id).exec();
  if (doc) await doc.patch(patch);
}

async function removeFromRxDb(item: TrashItem) {
  const db = await useRxDbSafe();
  if (!db) return;
  const colName = rxCollectionMap[item.entityType];
  if (!colName) return;
  const col = (db as any)[colName];
  if (!col) return;
  const doc = await col.findOne(item.id).exec();
  if (doc) await doc.remove();
}

async function handleRestore(item: TrashItem) {
  activeAction.value = null;
  isActing.value = true;
  const promise = $fetch(`/api/workspace/${workspaceId.value}/trash/restore`, {
    method: "POST",
    body: { entityType: item.entityType, entityId: item.id },
  });
  toast.promise(promise, {
    loading: `Restoring ${entityConfig[item.entityType]?.label ?? "item"}...`,
    success: `${item.title} restored`,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't restore item",
    errorDesc: "Try again later",
    position: "top-center",
  });
  try {
    await promise;
    await patchRxDb(item, { deleted_at: null, updated_at: new Date().toISOString() });
    items.value = items.value.filter((i) => i.id !== item.id);
  } catch {
  } finally {
    isActing.value = false;
  }
}

async function handlePermanentDelete(item: TrashItem) {
  activeAction.value = null;
  isActing.value = true;
  const promise = $fetch(`/api/workspace/${workspaceId.value}/trash/permanent`, {
    method: "DELETE",
    body: { entityType: item.entityType, entityId: item.id },
  });
  toast.promise(promise, {
    loading: `Permanently deleting ${entityConfig[item.entityType]?.label ?? "item"}...`,
    success: `${item.title} permanently deleted`,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't delete item",
    errorDesc: "Try again later",
    position: "top-center",
  });
  try {
    await promise;
    await removeFromRxDb(item);
    items.value = items.value.filter((i) => i.id !== item.id);
  } catch {
  } finally {
    isActing.value = false;
  }
}

const groupedItems = computed(() => {
  const groups: Record<string, TrashItem[]> = {};
  for (const item of items.value) {
    if (!groups[item.entityType]) {
      groups[item.entityType] = [];
    }
    groups[item.entityType].push(item);
  }
  return groups;
});

const groupOrder = computed(() => {
  return Object.entries(groupedItems.value).sort(([, a], [, b]) => {
    const aNewest = a.reduce((latest, i) => (i.deletedAt > latest ? i.deletedAt : latest), "");
    const bNewest = b.reduce((latest, i) => (i.deletedAt > latest ? i.deletedAt : latest), "");
    return bNewest.localeCompare(aNewest);
  });
});

const isEmpty = computed(() => !loading.value && items.value.length === 0);

onMounted(() => {
  fetchTrash();
});
</script>

<template>
  <div>
    <NuxtLayout name="workspace">
      <NuxtLayout name="workspace-area">
        <section class="space-y-4 p-3">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="font-medium">Trash</h1>
              <p class="max-w-2xl text-sm text-muted-foreground">
                Items moved to trash can be restored or permanently deleted.
              </p>
            </div>
            <Button v-if="items.length > 0" variant="outline" size="sm" @click="fetchTrash">
              <Icon name="lucide:refresh-cw" size="14" class="mr-1" />
              Refresh
            </Button>
          </div>

          <div v-if="loading" class="flex items-center justify-center py-16">
            <Loader class="size-6 animate-spin text-muted-foreground" />
          </div>

          <div v-else-if="error" class="flex flex-col items-center justify-center gap-2 py-16">
            <Icon name="lucide:alert-circle" size="32" class="text-red-500" />
            <p class="text-sm text-muted-foreground">{{ error }}</p>
            <Button variant="outline" size="sm" @click="fetchTrash">Try again</Button>
          </div>

          <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-16">
            <Icon name="lucide:trash-2" size="40" class="text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">Trash is empty</p>
          </div>

          <div v-else class="space-y-6">
            <div v-for="[entityType, groupItems] in groupOrder" :key="entityType">
              <div class="mb-2 flex items-center gap-2">
                <Icon
                  :name="entityConfig[entityType]?.icon ?? 'lucide:file'"
                  size="16"
                  class="text-muted-foreground"
                />
                <h2 class="text-sm font-medium text-muted-foreground">
                  {{ entityConfig[entityType]?.label ?? entityType }}
                </h2>
                <span class="text-xs text-muted-foreground/60">({{ groupItems.length }})</span>
              </div>
              <div class="space-y-1">
                <div
                  v-for="item in groupItems"
                  :key="item.id"
                  class="group flex items-center justify-between rounded-lg border p-3 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800/50"
                >
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <div>
                      <p class="truncate text-sm font-medium">{{ item.title }}</p>
                      <p v-if="item.parentTitle" class="truncate text-xs text-muted-foreground/70">
                        {{ item.parentTitle }}
                      </p>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <span class="mr-2 hidden text-xs text-muted-foreground/60 sm:inline">
                      {{ new Date(item.deletedAt).toLocaleDateString() }}
                    </span>
                    <button
                      type="button"
                      class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      :disabled="isActing"
                      @click="handleRestore(item)"
                    >
                      <Icon name="lucide:rotate-ccw" size="12" />
                      Restore
                    </button>
                    <button
                      type="button"
                      class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      :disabled="isActing"
                      @click="activeAction = { type: 'permanent', item }"
                    >
                      <Icon name="lucide:trash-2" size="12" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </NuxtLayout>
    </NuxtLayout>

    <AlertDialog
      :open="activeAction?.type === 'permanent'"
      @update:open="
        (v) => {
          if (!v) activeAction = null;
        }
      "
    >
      <AlertDialogContent class="dark:bg-[#1d1d1d]">
        <AlertDialogHeader>
          <div class="flex items-center gap-x-2">
            <div class="mt-1 grid shrink-0 place-items-center self-start rounded-full">
              <Icon name="lucide:trash-2" class="text-red-500" size="25" />
            </div>
            <div class="grid gap-0.5 self-start">
              <AlertDialogTitle class="text-brand">Permanently delete?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{{ activeAction?.item.title }}</strong
                >. This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <div class="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            :disabled="isActing"
            :class="
              cn(
                'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
                'cursor-pointer bg-red-600 hover:bg-red-700',
                isActing && 'cursor-not-allowed opacity-50',
              )
            "
            @click="activeAction && handlePermanentDelete(activeAction.item)"
          >
            <Loader v-if="isActing" class="size-5 animate-spin" />
            <Icon v-else name="lucide:trash-2" class="size-4" />
            Delete permanently
          </button>
          <Button
            type="button"
            :disabled="isActing"
            variant="ghost"
            class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap transition-all"
            @click="activeAction = null"
          >
            Cancel
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
