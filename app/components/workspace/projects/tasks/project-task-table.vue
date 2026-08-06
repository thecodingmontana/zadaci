<script setup lang="ts">
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/vue-table";
import type { TaskDocType } from "~/plugins/rxdb.client";
import { Search as SearchIcon, X as XIcon } from "@lucide/vue";
import { MixerHorizontalIcon } from "@radix-icons/vue";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { format } from "date-fns";
import { h } from "vue";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import DataGridColumnHeader from "~/components/ui/data-grid/data-grid-column-header.vue";
import DataGridColumnVisibility from "~/components/ui/data-grid/data-grid-column-visibility.vue";
import DataGridPagination from "~/components/ui/data-grid/data-grid-pagination.vue";
import DataGridTable from "~/components/ui/data-grid/data-grid-table.vue";
import DataGrid from "~/components/ui/data-grid/data-grid.vue";
import { Input } from "~/components/ui/input";
import { useProjectTasks } from "~/composables/use-project-tasks";
import { cn, valueUpdater } from "~/lib/utils";

const props = defineProps<{
  workspaceId: string;
  projectId: string;
  searchQuery?: string;
  parentTaskId?: string | null;
}>();

const searchQuery = defineModel<string>("searchQuery", { default: "" });

const { topLevelTasks, subtaskCounts } = useProjectTasks(() => ({
  projectId: props.projectId,
  parentTaskId: props.parentTaskId,
}));

const statusStyles: Record<string, { label: string; badge: string }> = {
  idea: { label: "Idea", badge: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
  todo: { label: "Todo", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  in_progress: {
    label: "In Progress",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  in_review: { label: "In Review", badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  completed: { label: "Completed", badge: "bg-green-500/15 text-green-600 dark:text-green-400" },
  abandoned: { label: "Abandoned", badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const priorityColors: Record<TaskDocType["priority"], string> = {
  urgent: "bg-rose-500",
  high: "bg-rose-400",
  medium: "bg-amber-500",
  low: "bg-purple-400",
  none: "bg-zinc-400",
};

function statusLabel(status: TaskDocType["status"]) {
  return statusStyles[status]?.label ?? status;
}

const sorting = ref<SortingState>([{ id: "created_at", desc: true }]);
const columnVisibility = ref<VisibilityState>({});
const rowSelection = ref({});

const columns: ColumnDef<TaskDocType>[] = [
  {
    accessorKey: "name",
    id: "name",
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Task", visibility: true }),
    cell: ({ row }) =>
      h(
        "div",
        { class: "cursor-pointer font-medium text-foreground hover:underline" },
        row.original.name,
      ),
    filterFn: (row, _, filterValue: string) => {
      const name = row.original.name?.toLowerCase() ?? "";
      return name.includes(filterValue.toLowerCase());
    },
    enableHiding: false,
    size: 320,
    meta: { headerTitle: "Task" },
  },
  {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Status", visibility: true }),
    cell: ({ row }) =>
      h(
        Badge,
        {
          variant: "secondary",
          class: cn(
            "gap-1 rounded px-1.5 py-0 font-medium",
            statusStyles[row.original.status]?.badge,
          ),
        },
        { default: () => statusLabel(row.original.status) },
      ),
    size: 130,
    meta: { headerTitle: "Status" },
  },
  {
    accessorKey: "priority",
    id: "priority",
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "Priority", visibility: true }),
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-1.5 capitalize text-muted-foreground" }, [
        h("span", { class: cn("size-2 rounded-full", priorityColors[row.original.priority]) }),
        h("span", row.original.priority),
      ]),
    size: 110,
    meta: { headerTitle: "Priority" },
  },
  {
    id: "subtasks",
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "Subtasks", visibility: true }),
    cell: ({ row }) => {
      const counts = subtaskCounts.value[row.original.id];
      if (!counts || counts.total === 0) return h("span", { class: "text-muted-foreground" }, "—");
      return h("span", { class: "text-muted-foreground" }, `${counts.completed}/${counts.total}`);
    },
    size: 100,
    meta: { headerTitle: "Subtasks" },
  },
  {
    accessorKey: "due_date",
    id: "due_date",
    header: ({ column }) =>
      h(DataGridColumnHeader, { column, title: "Due Date", visibility: true }),
    cell: ({ row }) =>
      row.original.due_date
        ? h(
            "span",
            { class: "text-muted-foreground" },
            format(new Date(row.original.due_date), "MMM d, yyyy"),
          )
        : h("span", { class: "text-muted-foreground/60" }, "—"),
    size: 140,
    meta: { headerTitle: "Due Date" },
  },
  {
    accessorKey: "created_at",
    id: "created_at",
    header: ({ column }) => h(DataGridColumnHeader, { column, title: "Created", visibility: true }),
    cell: ({ row }) =>
      h(
        "span",
        { class: "text-muted-foreground" },
        format(new Date(row.original.created_at), "MMM d, yyyy"),
      ),
    size: 130,
    meta: { headerTitle: "Created" },
  },
];

const table = useVueTable({
  get data() {
    return topLevelTasks.value;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updaterOrValue) => valueUpdater(updaterOrValue, sorting),
  onColumnVisibilityChange: (updaterOrValue) => valueUpdater(updaterOrValue, columnVisibility),
  onRowSelectionChange: (updaterOrValue) => valueUpdater(updaterOrValue, rowSelection),
  state: {
    get sorting() {
      return sorting.value;
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
  table.getColumn("name")?.setFilterValue(value);
});

function openTask(task: TaskDocType) {
  navigateTo(`/workspace/${props.workspaceId}/tasks/${task.id}`);
}
</script>

<template>
  <DataGrid
    :table="table"
    :record-count="topLevelTasks.length"
    :is-loading="false"
    :on-row-click="(task: TaskDocType) => openTask(task)"
    :table-layout="{ columnsVisibility: true, headerSticky: true }"
  >
    <div class="rounded-lg border dark:bg-[#1d1d1d]">
      <div class="flex flex-col gap-2.5 border-b p-4">
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="relative w-full lg:max-w-xs">
            <SearchIcon
              class="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="searchQuery"
              class="w-full ps-9 dark:bg-[#1d1d1d] dark:hover:bg-muted"
              placeholder="Search tasks..."
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
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">
              {{ topLevelTasks.length }} task{{ topLevelTasks.length === 1 ? "" : "s" }}
            </span>
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
</template>
