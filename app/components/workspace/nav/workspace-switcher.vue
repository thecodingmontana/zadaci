<script setup lang="ts">
import { Check, ChevronsUpDown, Plus, Sparkles } from "@lucide/vue";
import { AnimatePresence, motion } from "motion-v";
import { computed, ref } from "vue";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SidebarMenuButton, SidebarTrigger, useSidebar } from "~/components/ui/sidebar";

interface Workspace {
  id: string;
  name: string;
  plan: string;
}

const { state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");

const workspaces = ref<Workspace[]>([
  { id: "1", name: "Ecomiq", plan: "Pro" },
  { id: "2", name: "Goodsncart", plan: "Free" },
  { id: "3", name: "Modsley Labs", plan: "Pro" },
]);

const active = ref(workspaces.value[0]);
const open = ref(false);

function selectWorkspace(ws: Workspace) {
  active.value = ws;
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <SidebarMenuButton
        size="lg"
        class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <div
          class="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
        >
          <Sparkles class="size-4" />
        </div>

        <AnimatePresence>
          <motion.div
            v-if="!isCollapsed"
            :initial="{ opacity: 0, width: 0 }"
            :animate="{ opacity: 1, width: 'auto' }"
            :exit="{ opacity: 0, width: 0 }"
            :transition="{ duration: 0.15 }"
            class="grid flex-1 overflow-hidden text-left text-sm leading-tight"
          >
            <span class="truncate font-semibold">{{ active?.name }}</span>
            <span class="truncate text-xs text-sidebar-foreground/60">{{ active?.plan }} plan</span>
          </motion.div>
        </AnimatePresence>

        <ChevronsUpDown v-if="!isCollapsed" class="ml-auto size-4 shrink-0 opacity-60" />
      </SidebarMenuButton>
    </PopoverTrigger>

    <PopoverContent class="w-64 p-0" align="start" side="bottom">
      <Command>
        <CommandInput placeholder="Find workspace..." />
        <CommandList>
          <CommandEmpty>No workspace found.</CommandEmpty>
          <CommandGroup heading="Workspaces">
            <CommandItem
              v-for="ws in workspaces"
              :key="ws.id"
              :value="ws.name"
              class="cursor-pointer"
              @select="selectWorkspace(ws)"
            >
              <div
                class="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-medium"
              >
                {{ ws.name.slice(0, 2).toUpperCase() }}
              </div>
              <span class="flex-1 truncate">{{ ws.name }}</span>
              <Check v-if="active.id === ws.id" class="size-4" />
            </CommandItem>
          </CommandGroup>
          <CommandGroup>
            <CommandItem value="create-workspace" class="cursor-pointer">
              <Plus class="size-4" />
              <span>Create workspace</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>

  <!-- collapse toggle, sits beside the switcher when expanded -->
  <SidebarTrigger class="shrink-0" />
</template>
