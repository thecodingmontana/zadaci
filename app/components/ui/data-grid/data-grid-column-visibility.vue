<script setup lang="ts">
import type { Table } from "@tanstack/vue-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

defineProps<{ table: Table<any> }>();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-37.5">
      <DropdownMenuLabel class="font-medium"> Toggle Columns </DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        v-for="column in table
          .getAllColumns()
          .filter((c) => typeof c.accessorFn !== 'undefined' && c.getCanHide())"
        :key="column.id"
        class="capitalize"
        :model-value="column.getIsVisible()"
        @update:model-value="(value: boolean) => column.toggleVisibility(!!value)"
      >
        {{ column.columnDef.meta?.headerTitle || column.id }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
