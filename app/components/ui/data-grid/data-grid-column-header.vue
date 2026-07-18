<script setup lang="ts">
import type { Column } from "@tanstack/vue-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, EyeOffIcon } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

interface DataGridColumnHeaderProps {
  column: Column<any, any>;
  title: string;
  visibility?: boolean;
}

const props = withDefaults(defineProps<DataGridColumnHeaderProps>(), { visibility: false });

const sortingIcon = computed(() => {
  const sorted = props.column.getIsSorted();
  if (sorted === "asc") return ArrowUpIcon;
  if (sorted === "desc") return ArrowDownIcon;
  return ChevronsUpDownIcon;
});
</script>

<template>
  <div class="flex items-center space-x-2">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          :class="cn('h-8 data-[state=open]:bg-accent', column.getIsSorted() && 'text-foreground')"
        >
          <span>{{ title }}</span>
          <component :is="sortingIcon" class="ml-2 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="column.toggleSorting(false)">
          <ArrowUpIcon class="mr-2 size-3.5 text-muted-foreground/70" />
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem @click="column.toggleSorting(true)">
          <ArrowDownIcon class="mr-2 size-3.5 text-muted-foreground/70" />
          Desc
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="visibility" />
        <DropdownMenuItem v-if="visibility" @click="column.toggleVisibility(false)">
          <EyeOffIcon class="mr-2 size-3.5 text-muted-foreground/70" />
          Hide
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
