<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { useDataGrid } from "~/composables/use-data-grid";
import { cn } from "~/lib/utils";

const props = withDefaults(
  defineProps<{
    sizes?: number[];
    moreLimit?: number;
    rowsPerPageLabel?: string;
    info?: string;
  }>(),
  {
    sizes: () => [10, 20, 30, 40, 50],
    moreLimit: 5,
    rowsPerPageLabel: "Rows per page",
    info: "{from} - {to} of {count}",
  },
);

const { table, recordCount, isLoading } = useDataGrid();

const pageIndex = computed(() => table.getState().pagination.pageIndex);
const pageSize = computed(() => table.getState().pagination.pageSize);
const pageCount = computed(() => table.getPageCount());

const from = computed(() => (recordCount.value === 0 ? 0 : pageIndex.value * pageSize.value + 1));
const to = computed(() => Math.min((pageIndex.value + 1) * pageSize.value, recordCount.value));

const paginationInfo = computed(() =>
  props.info
    .replace("{from}", String(from.value))
    .replace("{to}", String(to.value))
    .replace("{count}", String(recordCount.value)),
);

const currentGroupStart = computed(
  () => Math.floor(pageIndex.value / props.moreLimit) * props.moreLimit,
);
const currentGroupEnd = computed(() =>
  Math.min(currentGroupStart.value + props.moreLimit, pageCount.value),
);
const pageButtons = computed(() => {
  const arr: number[] = [];
  for (let i = currentGroupStart.value; i < currentGroupEnd.value; i++) arr.push(i);
  return arr;
});

function handlePageSizeChange(value: unknown) {
  table.setPageSize(Number(value));
}
</script>

<template>
  <div
    class="flex grow flex-col flex-wrap items-center justify-between gap-2.5 py-2.5 sm:flex-row sm:py-0"
  >
    <div class="order-2 flex flex-wrap items-center space-x-2.5 pb-2.5 sm:order-1 sm:pb-0">
      <Skeleton v-if="isLoading" class="h-8 w-44" />
      <template v-else>
        <div class="text-sm text-muted-foreground">
          {{ rowsPerPageLabel }}
        </div>
        <Select :model-value="`${pageSize}`" @update:model-value="handlePageSizeChange">
          <SelectTrigger class="h-8 w-fit">
            <SelectValue :placeholder="`${pageSize}`" />
          </SelectTrigger>
          <SelectContent side="top" class="min-w-12.5">
            <SelectItem v-for="size in sizes" :key="size" :value="`${size}`">
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>
    </div>

    <div
      class="order-1 flex flex-col items-center justify-center gap-2.5 pt-2.5 sm:order-2 sm:flex-row sm:justify-end sm:pt-0"
    >
      <Skeleton v-if="isLoading" class="h-8 w-60" />
      <template v-else>
        <div class="order-2 text-sm text-nowrap text-muted-foreground sm:order-1">
          {{ paginationInfo }}
        </div>
        <div v-if="pageCount > 1" class="order-1 flex items-center space-x-1 sm:order-2">
          <Button
            variant="ghost"
            class="size-7 p-0 text-sm"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            <span class="sr-only">Go to previous page</span>
            <ChevronLeftIcon class="size-4" />
          </Button>
          <Button
            v-if="currentGroupStart > 0"
            variant="ghost"
            class="size-7 p-0 text-sm"
            @click="table.setPageIndex(currentGroupStart - 1)"
          >
            ...
          </Button>
          <Button
            v-for="i in pageButtons"
            :key="i"
            variant="ghost"
            :class="
              cn(
                'size-7 p-0 text-sm text-muted-foreground',
                pageIndex === i && 'bg-accent text-accent-foreground',
              )
            "
            @click="pageIndex !== i && table.setPageIndex(i)"
          >
            {{ i + 1 }}
          </Button>
          <Button
            v-if="currentGroupEnd < pageCount"
            variant="ghost"
            class="size-7 p-0 text-sm"
            @click="table.setPageIndex(currentGroupEnd)"
          >
            ...
          </Button>
          <Button
            variant="ghost"
            class="size-7 p-0 text-sm"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            <span class="sr-only">Go to next page</span>
            <ChevronRightIcon class="size-4" />
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
