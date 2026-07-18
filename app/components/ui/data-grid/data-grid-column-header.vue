<script setup lang="ts">
import type { Column } from "@tanstack/vue-table";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowLeftToLineIcon,
  ArrowRightIcon,
  ArrowRightToLineIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  PinOffIcon,
  Settings2Icon,
} from "@lucide/vue";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useDataGrid } from "~/composables/use-data-grid";

const props = withDefaults(
  defineProps<{
    column: Column<any, any>;
    title?: string;
    visibility?: boolean;
  }>(),
  {
    title: "",
    visibility: false,
  },
);

const { table, props: gridProps, isLoading, recordCount } = useDataGrid();

function moveColumn(direction: "left" | "right") {
  const order = [...table.getState().columnOrder];
  const index = order.indexOf(props.column.id);
  if (direction === "left" && index > 0) {
    const [moved] = order.splice(index, 1);
    order.splice(index - 1, 0, moved!);
    table.setColumnOrder(order);
  }
  if (direction === "right" && index < order.length - 1) {
    const [moved] = order.splice(index, 1);
    order.splice(index + 1, 0, moved!);
    table.setColumnOrder(order);
  }
}

function canMove(direction: "left" | "right") {
  const order = table.getState().columnOrder;
  const index = order.indexOf(props.column.id);
  return direction === "left" ? index > 0 : index < order.length - 1;
}

function onSortClick() {
  const sorted = props.column.getIsSorted();
  if (sorted === "asc") props.column.toggleSorting(true);
  else if (sorted === "desc") props.column.clearSorting();
  else props.column.toggleSorting(false);
}

const hasControls = computed(
  () =>
    gridProps.tableLayout?.columnsMovable ||
    (gridProps.tableLayout?.columnsVisibility && props.visibility) ||
    (gridProps.tableLayout?.columnsPinnable && props.column.getCanPin()),
);

const headerButtonClass =
  "h-7 -ms-2 rounded-md px-2 font-normal text-secondary-foreground/80 hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground";
</script>

<template>
  <div v-if="hasControls" class="flex h-full items-center justify-between gap-1.5">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          :class="headerButtonClass"
          :disabled="isLoading || recordCount === 0"
        >
          <span>{{ title }}</span>
          <ArrowDownIcon v-if="column.getIsSorted() === 'desc'" class="ml-1 size-3.5" />
          <ArrowUpIcon v-else-if="column.getIsSorted() === 'asc'" class="ml-1 size-3.5" />
          <ChevronsUpDownIcon v-else-if="column.getCanSort()" class="ml-1 size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-40">
        <template v-if="column.getCanSort()">
          <DropdownMenuItem
            @click="
              column.getIsSorted() === 'asc' ? column.clearSorting() : column.toggleSorting(false)
            "
          >
            <ArrowUpIcon class="size-3.5" />
            <span class="grow">Asc</span>
            <CheckIcon v-if="column.getIsSorted() === 'asc'" class="size-4 text-primary" />
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="
              column.getIsSorted() === 'desc' ? column.clearSorting() : column.toggleSorting(true)
            "
          >
            <ArrowDownIcon class="size-3.5" />
            <span class="grow">Desc</span>
            <CheckIcon v-if="column.getIsSorted() === 'desc'" class="size-4 text-primary" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>

        <template v-if="gridProps.tableLayout?.columnsPinnable && column.getCanPin()">
          <DropdownMenuItem @click="column.pin(column.getIsPinned() === 'left' ? false : 'left')">
            <ArrowLeftToLineIcon class="size-3.5" />
            <span class="grow">Pin to left</span>
            <CheckIcon v-if="column.getIsPinned() === 'left'" class="size-4 text-primary" />
          </DropdownMenuItem>
          <DropdownMenuItem @click="column.pin(column.getIsPinned() === 'right' ? false : 'right')">
            <ArrowRightToLineIcon class="size-3.5" />
            <span class="grow">Pin to right</span>
            <CheckIcon v-if="column.getIsPinned() === 'right'" class="size-4 text-primary" />
          </DropdownMenuItem>
        </template>

        <template v-if="gridProps.tableLayout?.columnsMovable">
          <DropdownMenuSeparator />
          <DropdownMenuItem
            :disabled="!canMove('left') || column.getIsPinned() !== false"
            @click="moveColumn('left')"
          >
            <ArrowLeftIcon class="size-3.5" />
            <span>Move left</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="!canMove('right') || column.getIsPinned() !== false"
            @click="moveColumn('right')"
          >
            <ArrowRightIcon class="size-3.5" />
            <span>Move right</span>
          </DropdownMenuItem>
        </template>

        <template v-if="gridProps.tableLayout?.columnsVisibility && visibility">
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Settings2Icon class="size-3.5" />
              <span>Columns</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem
                v-for="col in table
                  .getAllColumns()
                  .filter((c) => typeof c.accessorFn !== 'undefined' && c.getCanHide())"
                :key="col.id"
                class="capitalize"
                :model-value="col.getIsVisible()"
                @update:model-value="(value: boolean) => col.toggleVisibility(!!value)"
              >
                {{ col.columnDef.meta?.headerTitle || col.id }}
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button
      v-if="gridProps.tableLayout?.columnsPinnable && column.getCanPin() && column.getIsPinned()"
      variant="ghost"
      class="-me-1 size-7 rounded-md p-0"
      @click="column.pin(false)"
    >
      <PinOffIcon class="size-3.5 opacity-50" />
    </Button>
  </div>

  <div v-else-if="column.getCanSort()" class="flex h-full items-center">
    <Button
      variant="ghost"
      :class="headerButtonClass"
      :disabled="isLoading || recordCount === 0"
      @click="onSortClick"
    >
      <span>{{ title }}</span>
      <ArrowDownIcon v-if="column.getIsSorted() === 'desc'" class="ml-1 size-3.5" />
      <ArrowUpIcon v-else-if="column.getIsSorted() === 'asc'" class="ml-1 size-3.5" />
      <ChevronsUpDownIcon v-else class="ml-1 size-3.5" />
    </Button>
  </div>

  <div
    v-else
    class="inline-flex h-full items-center gap-1.5 text-[0.8125rem] font-normal text-secondary-foreground/80"
  >
    {{ title }}
  </div>
</template>
