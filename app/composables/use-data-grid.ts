import type { RowData, Table } from "@tanstack/vue-table";
import type { ComputedRef, InjectionKey } from "vue";

declare module "@tanstack/vue-table" {
  interface ColumnMeta<_TData extends RowData, _TValue> {
    cellClassName?: string;
    headerClassName?: string;
    headerTitle?: string;
  }
}

export interface DataGridTableLayout {
  dense?: boolean;
  cellBorder?: boolean;
  rowBorder?: boolean;
  rowRounded?: boolean;
  stripped?: boolean;
  headerBackground?: boolean;
  headerBorder?: boolean;
  headerSticky?: boolean;
  width?: "auto" | "fixed";
  columnsVisibility?: boolean;
  columnsResizable?: boolean;
  columnsPinnable?: boolean;
  columnsMovable?: boolean;
}

export interface DataGridTableClassNames {
  base?: string;
  header?: string;
  headerRow?: string;
  headerSticky?: string;
  body?: string;
  bodyRow?: string;
  footer?: string;
  edgeCell?: string;
}

export interface DataGridProps {
  isLoading?: boolean;
  loadingMode?: "skeleton" | "spinner";
  loadingMessage?: string;
  emptyMessage?: string;
  recordCount: number;
  onRowClick?: (row: any) => void;
  tableLayout?: DataGridTableLayout;
  tableClassNames?: DataGridTableClassNames;
}

export interface DataGridContext {
  table: Table<any>;
  props: DataGridProps;
  isLoading: ComputedRef<boolean>;
  recordCount: ComputedRef<number>;
}

export const DataGridKey: InjectionKey<DataGridContext> = Symbol("DataGrid");

export function provideDataGrid(table: Table<any>, props: DataGridProps) {
  const ctx: DataGridContext = {
    table,
    props,
    isLoading: computed(() => !!props.isLoading),
    recordCount: computed(() => props.recordCount ?? 0),
  };
  provide(DataGridKey, ctx);
  return ctx;
}

export function useDataGrid() {
  const ctx = inject(DataGridKey);
  if (!ctx) throw new Error("useDataGrid must be used within a <DataGrid> provider");
  return ctx;
}
