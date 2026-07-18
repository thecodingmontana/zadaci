<script setup lang="ts">
import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/vue-table";
import type { TeammatesWithProfile } from "~/types";
import { Search as SearchIcon, ServerCrash, X as XIcon } from "@lucide/vue";
import { MixerHorizontalIcon } from "@radix-icons/vue";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import SkeletonLoading from "~/components/global/skeleton-loading.vue";
import { Button } from "~/components/ui/button";
import DataGridColumnFilter from "~/components/ui/data-grid/data-grid-column-filter.vue";
import DataGridColumnVisibility from "~/components/ui/data-grid/data-grid-column-visibility.vue";
import DataGridPagination from "~/components/ui/data-grid/data-grid-pagination.vue";
import DataGridTable from "~/components/ui/data-grid/data-grid-table.vue";
import DataGrid from "~/components/ui/data-grid/data-grid.vue";
import { Input } from "~/components/ui/input";
import { toast } from "~/lib/toast";
import { cn, valueUpdater } from "~/lib/utils";
import { useWorkspaceStore } from "~/stores/use-workspace-store";
import { auth2fas, roles } from "~/types";
import { columns } from "./columns";

const workspaceStore = useWorkspaceStore();
const modalStore = useModalStore();
const currentActiveWorkspace = computed(() => workspaceStore.activeWorkspace);

const { data: workspace, status } = await useAsyncData(
  "workspace_teammates",
  () => useRequestFetch()(`/api/workspace/${currentActiveWorkspace.value?.id}/teammates`),
  { watch: [() => currentActiveWorkspace.value?.id || ""] },
);

const members = computed<TeammatesWithProfile[]>(() =>
  (workspace.value?.members ?? []).map((member: any) => ({
    id: member.id,
    createdAt: member.created_at,
    updatedAt: member.updated_at,
    userId: member.user_id,
    workspaceId: member.workspace_id,
    role: member.role,
    user: {
      id: member.user.id,
      email: member.user.email,
      username: member.user.username ?? null,
      emailVerified: member.user.email_verified,
      registered2FA: member.user.registered_2fa,
      profilePictureUrl: member.user.profile_picture_url ?? null,
    },
  })),
);

const sorting = ref<SortingState>([{ id: "createdAt", desc: true }]);
const columnFilters = ref<ColumnFiltersState>([]);
const columnVisibility = ref<VisibilityState>({});
const rowSelection = ref({});
const searchQuery = ref("");
const isBusy = ref(false);

const table = useVueTable({
  get data() {
    return members.value;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updaterOrValue) => valueUpdater(updaterOrValue, sorting),
  onColumnFiltersChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnFilters),
  onColumnVisibilityChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnVisibility),
  onRowSelectionChange: (updaterOrValue) => valueUpdater(updaterOrValue, rowSelection),
  state: {
    get sorting() {
      return sorting.value;
    },
    get columnFilters() {
      return columnFilters.value;
    },
    get columnVisibility() {
      return columnVisibility.value;
    },
    get rowSelection() {
      return rowSelection.value;
    },
  },
});

watch(searchQuery, (value) => {
  table.getColumn("user")?.setFilterValue(value);
});

async function onRefresh() {
  isBusy.value = true;
  try {
    await refreshNuxtData("workspace_teammates");
  } finally {
    isBusy.value = false;
  }
}

function onBulkChangeRole() {
  const rows = table.getFilteredSelectedRowModel().rows;
  if (!rows.length) return;
  modalStore?.onOpen("changeTeammateRole");
  modalStore?.setIsOpen(true);
  modalStore?.setModalData({
    teammates: rows.map((r) => ({
      id: r.original.userId,
      role: r.original.role,
      avatar: r.original.user.profilePictureUrl as string,
      username: r.original.user.username as string,
      email: r.original.user.email,
    })),
  });
}

async function onBulkRemove() {
  const rows = table.getFilteredSelectedRowModel().rows;
  if (!rows.length) return;
  const workspaceId = currentActiveWorkspace.value?.id as string;
  const userIds = rows.map((r) => r.original.userId);

  isBusy.value = true;
  try {
    const data = await $fetch<{ message: string }>(
      `/api/workspace/${workspaceId}/teammates/remove`,
      {
        method: "DELETE",
        body: { userIds, workspaceId },
      },
    );
    toast.success(data.message);
    await refreshNuxtData();
    rowSelection.value = {};
  } catch (error: any) {
    toast.error(
      error.response?._data?.statusMessage ?? error.message ?? "Failed to remove teammates",
    );
  } finally {
    isBusy.value = false;
  }
}

function onAddUser() {
  modalStore?.onOpen("inviteTeammate");
  modalStore?.setIsOpen(true);
}
</script>

<template>
  <div>
    <SkeletonLoading v-if="status === 'pending' || status === 'idle'" />

    <div v-else-if="status === 'error'" class="rounded-lg border">
      <div class="flex items-center justify-center gap-1.5 p-5 text-destructive dark:text-primary">
        <ServerCrash class="size-5" />
        Failed to load members table data.
      </div>
    </div>

    <DataGrid
      v-else
      :table="table"
      :record-count="members.length"
      :is-loading="isBusy"
      :table-layout="{ columnsVisibility: true, headerSticky: true }"
    >
      <div class="rounded-lg border dark:bg-[#1d1d1d]">
        <div class="flex flex-col gap-2.5 border-b p-4">
          <div class="flex w-full flex-col items-center gap-2.5 lg:flex-row">
            <div class="relative w-full lg:max-w-xs">
              <SearchIcon
                class="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                v-model="searchQuery"
                class="w-full ps-9 dark:bg-[#1d1d1d] dark:hover:bg-muted"
                placeholder="Filter member..."
              />
              <Button
                v-if="searchQuery.length > 0"
                variant="ghost"
                class="absolute end-1.5 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                @click="searchQuery = ''"
              >
                <XIcon class="size-4" />
              </Button>
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              <DataGridColumnFilter
                v-if="table.getColumn('role')"
                :column="table.getColumn('role') as any"
                title="Role"
                :options="roles"
              />
              <DataGridColumnFilter
                v-if="table.getColumn('registered2FA')"
                :column="table.getColumn('registered2FA') as any"
                title="2FA Auth"
                :options="auth2fas"
              />
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2.5">
            <div class="text-sm text-muted-foreground">
              {{ members.length }} member{{ members.length === 1 ? "" : "s" }}
            </div>
            <div class="flex items-center gap-2">
              <Button
                v-if="table.getFilteredSelectedRowModel().rows.length > 0"
                class="h-8 bg-brand hover:bg-brand-secondary dark:bg-primary"
                :disabled="isBusy"
                @click="onBulkChangeRole"
              >
                <Icon name="hugeicons:user-edit-01" class="size-4" />
                Change role ({{ table.getFilteredSelectedRowModel().rows.length }})
              </Button>
              <Button
                v-if="table.getFilteredSelectedRowModel().rows.length > 0"
                variant="destructive"
                class="h-8 dark:bg-[#1d1d1d] dark:hover:bg-muted"
                :disabled="isBusy"
                @click="onBulkRemove"
              >
                <Icon name="solar:trash-bin-minimalistic-linear" class="size-4" />
                Remove ({{ table.getFilteredSelectedRowModel().rows.length }})
              </Button>
              <Button
                variant="outline"
                class="h-8 dark:bg-[#1d1d1d] dark:hover:bg-muted"
                :disabled="isBusy"
                @click="onRefresh"
              >
                <Icon name="solar:refresh-linear" :class="cn('size-4', isBusy && 'animate-spin')" />
              </Button>
              <Button
                variant="outline"
                class="h-8 dark:bg-[#1d1d1d] dark:hover:bg-muted"
                @click="onAddUser"
              >
                <Icon name="hugeicons:user-add-01" class="size-4" />
                <span class="hidden md:block">Add user(s)</span>
              </Button>
              <DataGridColumnVisibility :table="table">
                <template #trigger>
                  <Button variant="outline" class="h-8 dark:bg-[#1d1d1d] dark:hover:bg-muted">
                    <MixerHorizontalIcon class="size-4" />
                    <span class="hidden md:block">View</span>
                  </Button>
                </template>
              </DataGridColumnVisibility>
            </div>
          </div>
        </div>

        <div class="max-h-[37.5rem] overflow-auto">
          <DataGridTable />
        </div>

        <div class="border-t px-4 py-2">
          <DataGridPagination />
        </div>
      </div>
    </DataGrid>
  </div>
</template>
