<script setup lang="ts">
import { FlexRender } from "@tanstack/vue-table";
import { useDataGrid } from "~/composables/use-data-grid";
import { cn } from "~/lib/utils";

const { table, props, isLoading } = useDataGrid();

const headerCellSpacing = computed(() => (props.tableLayout?.dense ? "h-9 px-2.5" : "px-4"));
const bodyCellSpacing = computed(() => (props.tableLayout?.dense ? "px-2.5 py-2" : "px-4 py-3"));

function pinningStyle(column: any) {
  const pinned = column.getIsPinned();
  return {
    left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    position: pinned ? ("sticky" as const) : ("relative" as const),
    zIndex: pinned ? 1 : 0,
  };
}
</script>

<template>
  <table
    :class="
      cn(
        'w-full caption-bottom text-left align-middle text-sm font-normal text-foreground',
        'border-separate border-spacing-0',
        props.tableLayout?.width === 'fixed' ? 'table-fixed' : 'table-auto',
        props.tableClassNames?.base,
      )
    "
  >
    <thead
      :class="
        cn(
          props.tableClassNames?.header,
          props.tableLayout?.headerSticky && props.tableClassNames?.headerSticky,
        )
      "
    >
      <tr
        v-for="headerGroup in table.getHeaderGroups()"
        :key="headerGroup.id"
        :class="
          cn(
            'bg-muted/40',
            props.tableLayout?.headerBorder && '[&>th]:border-b',
            props.tableLayout?.cellBorder && '*:last:border-e-0',
            props.tableLayout?.headerBackground === false && 'bg-transparent',
            props.tableClassNames?.headerRow,
          )
        "
      >
        <th
          v-for="header in headerGroup.headers"
          :key="header.id"
          :data-pinned="header.column.getIsPinned() || undefined"
          :style="{
            width: props.tableLayout?.width === 'fixed' ? `${header.getSize()}px` : undefined,
            ...(props.tableLayout?.columnsPinnable && header.column.getCanPin()
              ? pinningStyle(header.column)
              : {}),
          }"
          :class="
            cn(
              'relative h-10 text-left align-middle font-normal text-secondary-foreground/80 [&:has([role=checkbox])]:pe-0',
              headerCellSpacing,
              props.tableLayout?.cellBorder && 'border-e',
              props.tableLayout?.columnsResizable && header.column.getCanResize() && 'truncate',
              header.column.columnDef.meta?.headerClassName,
            )
          "
        >
          <FlexRender
            v-if="!header.isPlaceholder"
            :render="header.column.columnDef.header"
            :props="header.getContext()"
          />
          <div
            v-if="props.tableLayout?.columnsResizable && header.column.getCanResize()"
            class="absolute -end-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center select-none before:absolute before:inset-y-0 before:w-px before:-translate-x-px before:bg-border"
            @mousedown="header.getResizeHandler()($event)"
            @touchstart="header.getResizeHandler()($event)"
            @dblclick="header.column.resetSize()"
          />
        </th>
      </tr>
    </thead>

    <tbody v-if="!props.tableLayout?.rowBorder" aria-hidden="true" class="h-2" />

    <tbody
      :class="
        cn(
          '[&_tr:last-child]:border-0',
          props.tableLayout?.rowRounded &&
            '[&_td:first-child]:rounded-s-lg [&_td:last-child]:rounded-e-lg',
          props.tableClassNames?.body,
        )
      "
    >
      <template v-if="isLoading && props.loadingMode === 'skeleton'">
        <tr
          v-for="i in table.getState().pagination.pageSize"
          :key="`skeleton-${i}`"
          :class="
            cn(
              !props.tableLayout?.stripped &&
                props.tableLayout?.rowBorder &&
                'border-b border-border',
              props.tableClassNames?.bodyRow,
            )
          "
        >
          <td
            v-for="column in table.getVisibleFlatColumns()"
            :key="column.id"
            :class="cn('align-middle', bodyCellSpacing, column.columnDef.meta?.cellClassName)"
          >
            <div class="h-4 w-full animate-pulse rounded bg-muted" />
          </td>
        </tr>
      </template>

      <template v-else-if="isLoading && props.loadingMode === 'spinner'">
        <tr>
          <td :colspan="table.getVisibleFlatColumns().length" class="p-8">
            <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Icon name="svg-spinners:180-ring" class="size-5" />
              {{ props.loadingMessage || "Loading..." }}
            </div>
          </td>
        </tr>
      </template>

      <template v-else-if="table.getRowModel().rows.length">
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :data-state="row.getIsSelected() ? 'selected' : undefined"
          :class="
            cn(
              'hover:bg-muted/40 data-[state=selected]:bg-muted/50',
              props.onRowClick && 'cursor-pointer',
              !props.tableLayout?.stripped &&
                props.tableLayout?.rowBorder &&
                'border-b border-border [&:not(:last-child)>td]:border-b',
              props.tableLayout?.cellBorder && '*:last:border-e-0',
              props.tableLayout?.stripped &&
                'odd:bg-muted/90 hover:bg-transparent odd:hover:bg-muted',
              props.tableClassNames?.bodyRow,
            )
          "
          @click="props.onRowClick?.(row.original)"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :data-pinned="cell.column.getIsPinned() || undefined"
            :style="
              props.tableLayout?.columnsPinnable && cell.column.getCanPin()
                ? pinningStyle(cell.column)
                : {}
            "
            :class="
              cn(
                'align-middle',
                bodyCellSpacing,
                props.tableLayout?.cellBorder && 'border-e',
                cell.column.columnDef.meta?.cellClassName,
              )
            "
          >
            <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
          </td>
        </tr>
      </template>

      <template v-else>
        <tr>
          <td
            :colspan="table.getAllColumns().length"
            class="py-10 text-center text-muted-foreground"
          >
            {{ props.emptyMessage || "No results." }}
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
