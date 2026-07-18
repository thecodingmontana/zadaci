<script setup lang="ts">
import type { Table } from "@tanstack/vue-table";
import type {
  DataGridProps,
  DataGridTableClassNames,
  DataGridTableLayout,
} from "~/composables/use-data-grid";
import { provideDataGrid } from "~/composables/use-data-grid";

const props = defineProps<DataGridProps & { table: Table<any> }>();

const defaultTableLayout: DataGridTableLayout = {
  dense: false,
  cellBorder: false,
  rowBorder: true,
  rowRounded: false,
  stripped: false,
  headerSticky: false,
  headerBackground: true,
  headerBorder: true,
  width: "fixed",
  columnsVisibility: false,
  columnsResizable: false,
  columnsPinnable: false,
  columnsMovable: false,
};

const defaultTableClassNames: DataGridTableClassNames = {
  headerSticky: "sticky top-0 z-10 bg-background/90 backdrop-blur-xs",
};

const tableLayout = computed<DataGridTableLayout>(() => ({
  ...defaultTableLayout,
  ...props.tableLayout,
}));
const tableClassNames = computed<DataGridTableClassNames>(() => ({
  ...defaultTableClassNames,
  ...props.tableClassNames,
}));

const ctxProps = reactive({
  get isLoading() {
    return props.isLoading;
  },
  get loadingMode() {
    return props.loadingMode ?? "skeleton";
  },
  get loadingMessage() {
    return props.loadingMessage;
  },
  get emptyMessage() {
    return props.emptyMessage;
  },
  get recordCount() {
    return props.recordCount;
  },
  get onRowClick() {
    return props.onRowClick;
  },
  get tableLayout() {
    return tableLayout.value;
  },
  get tableClassNames() {
    return tableClassNames.value;
  },
});

provideDataGrid(props.table, ctxProps);
</script>

<template>
  <slot />
</template>
