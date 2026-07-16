<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";

interface MenuSection {
  key: string;
  label: string;
  icon: string;
  items: string[];
}

const sections = reactive<MenuSection[]>([
  {
    key: "tasks",
    label: "Tasks",
    icon: "hugeicons:task-01",
    items: ["Design Review", "API Integration", "QA Testing"],
  },
  {
    key: "projects",
    label: "Projects",
    icon: "hugeicons:folder-01",
    items: ["Orion Mobile", "Atlas Dashboard", "Epsilon Web"],
  },
  {
    key: "teams",
    label: "Teams",
    icon: "hugeicons:user-group",
    items: ["Design", "Engineering", "Product"],
  },
]);

const openSections = reactive<Record<string, boolean>>({
  tasks: false,
  projects: false,
  teams: false,
});

const toggleSection = (key: string) => {
  openSections[key] = !openSections[key];
};

const handleAdd = (key: string, event: Event) => {
  event.stopPropagation();
  console.log("add", key);
};
</script>

<template>
  <div class="space-y-2">
    <h3 class="font-ibm-plex-mono text-xs uppercase">Main Menu</h3>
    <div class="space-y-1">
      <div class="flex cursor-pointer items-center space-x-2 rounded bg-[#f2f2f2] p-1">
        <Icon name="hugeicons:dashboard-square-03" size="18" />
        <p>Dashboard</p>
      </div>

      <div
        class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <Icon name="hugeicons:user-multiple-02" size="18" />
        <p class="text-sm">Members</p>
      </div>

      <div
        class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <Icon name="hugeicons:calendar-03" size="18" />
        <p class="text-sm">Calendar</p>
      </div>

      <Collapsible
        v-for="section in sections"
        :key="section.key"
        :open="openSections[section.key]"
        @update:open="(val) => (openSections[section.key] = val)"
      >
        <div
          class="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          @click="toggleSection(section.key)"
        >
          <div class="flex items-center space-x-2">
            <Icon :name="section.icon" size="18" />
            <p class="text-sm">{{ section.label }}</p>
          </div>
          <div class="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-5 w-5 opacity-0 group-hover:opacity-100"
              @click="handleAdd(section.key, $event)"
            >
              <Icon name="hugeicons:plus-sign" size="14" />
            </Button>
            <CollapsibleTrigger as-child @click.stop>
              <Button variant="ghost" size="icon" class="h-5 w-5">
                <Icon
                  name="hugeicons:arrow-down-01"
                  size="14"
                  class="transition-transform duration-200"
                  :class="openSections[section.key] ? 'rotate-180' : ''"
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div class="mt-1 ml-6 space-y-1 border-l pl-2">
            <div
              v-for="item in section.items"
              :key="item"
              class="flex cursor-pointer items-center rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
            >
              {{ item }}
            </div>
            <div
              class="flex cursor-pointer items-center space-x-1 rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
              @click="handleAdd(section.key, $event)"
            >
              <Icon name="hugeicons:plus-sign" size="14" />
              <span>Add {{ section.label.slice(0, -1) }}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
