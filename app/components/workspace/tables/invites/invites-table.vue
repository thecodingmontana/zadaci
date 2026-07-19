<script setup lang="ts">
import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/vue-table";
import type { WorkspaceInvite } from "~/types";
import { Search as SearchIcon, ServerCrash, X as XIcon } from "@lucide/vue";
import { MixerHorizontalIcon } from "@radix-icons/vue";
import { useQueryClient } from "@tanstack/vue-query";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { Button } from "~/components/ui/button";
import DataGridColumnVisibility from "~/components/ui/data-grid/data-grid-column-visibility.vue";
import DataGridPagination from "~/components/ui/data-grid/data-grid-pagination.vue";
import DataGridTable from "~/components/ui/data-grid/data-grid-table.vue";
import DataGrid from "~/components/ui/data-grid/data-grid.vue";
import { Input } from "~/components/ui/input";
import SkeletonLoading from "~/components/workspace/shared/skeleton-loading.vue";
import { toast } from "~/lib/toast";
import { cn, valueUpdater } from "~/lib/utils";
import { columns } from "./columns";

const props = defineProps<{
  invites: WorkspaceInvite[];
  status: "pending" | "idle" | "success" | "error";
}>();

const queryClient = useQueryClient();
const sorting = ref<SortingState>([{ id: "expiresAt", desc: true }]);
const columnFilters = ref<ColumnFiltersState>([]);
const columnVisibility = ref<VisibilityState>({});
const rowSelection = ref({});
const searchQuery = ref("");
const isBusy = ref(false);

const table = useVueTable({
  get data() {
    return props.invites;
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
    queryClient.invalidateQueries({ queryKey: ["workspace-invites"] });
  } finally {
    isBusy.value = false;
  }
}

function onBulkRemove() {
  const rows = table.getFilteredSelectedRowModel().rows;
  if (!rows.length) return;
  const workspaceId = rows[0].original.workspaceId;
  const emails = rows.map((r) => r.original.email);

  isBusy.value = true;
  const promise = $fetch<{ message: string }>(
    `/api/workspace/${workspaceId}/teammates/team-invite/remove`,
    {
      method: "DELETE",
      body: { emails },
    },
  );
  toast.promise(promise, {
    loading: "Removing invites...",
    success: (data) => data.message,
    error: "Failed to remove invites",
  });
  promise
    .then(() => {
      queryClient.invalidateQueries({ queryKey: ["workspace-invites"] });
      rowSelection.value = {};
    })
    .catch(() => {})
    .finally(() => {
      isBusy.value = false;
    });
}
</script>

<template>
  <div>
    <SkeletonLoading v-if="props.status === 'pending' || props.status === 'idle'" />

    <div v-else-if="props.status === 'error'" class="rounded-lg border">
      <div class="flex items-center justify-center gap-1.5 p-5 text-destructive dark:text-primary">
        <ServerCrash class="size-5" />
        Failed to load invites data.
      </div>
    </div>

    <DataGrid
      v-else
      :table="table"
      :record-count="props.invites.length"
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
                placeholder="Filter inviter..."
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
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2.5">
            <div class="text-sm text-muted-foreground">
              {{ props.invites.length }} invite{{ props.invites.length === 1 ? "" : "s" }}
            </div>
            <div class="flex items-center gap-2">
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
