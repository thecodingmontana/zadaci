<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { ProjectDocType, TaskDocType, TeamDocType } from "~/plugins/rxdb.client";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { useModalStore } from "~/stores/use-modal-store";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const db = useRxDb();

const tasks = ref<TaskDocType[]>([]);
const projects = ref<ProjectDocType[]>([]);
const teams = ref<TeamDocType[]>([]);

const subscriptions: (() => void)[] = [];
const loading = ref(true);

function subscribeToCollection<T>(
  collection: RxCollection<T> | undefined,
  selector: any,
  target: { value: T[] },
  onData?: () => void,
): () => void {
  if (!collection) return () => {};
  const sub = collection.find({ selector }).$.subscribe((docs) => {
    target.value = docs;
    onData?.();
  });
  return () => sub.unsubscribe();
}

watch(
  [() => db, workspaceId],
  ([database, wsId]) => {
    subscriptions.forEach((fn) => fn());
    subscriptions.length = 0;
    if (!database || !wsId) {
      loading.value = true;
      return;
    }
    loading.value = true;
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) loading.value = false;
    };

    subscriptions.push(
      subscribeToCollection(
        database.tasks as any,
        { project_id: { $ne: "" } },
        tasks as any,
        markLoaded,
      ),
      subscribeToCollection(
        database.projects as any,
        { workspace_id: wsId },
        projects as any,
        markLoaded,
      ),
      subscribeToCollection(
        database.teams as any,
        { workspace_id: wsId },
        teams as any,
        markLoaded,
      ),
    );
  },
  { immediate: true },
);

onUnmounted(() => {
  subscriptions.forEach((fn) => fn());
});

interface MenuSection {
  key: string;
  label: string;
  icon: string;
  items: string[];
}

const sections: MenuSection[] = [
  { key: "tasks", label: "Tasks", icon: "hugeicons:task-01", items: [] },
  { key: "projects", label: "Projects", icon: "hugeicons:folder-01", items: [] },
  { key: "teams", label: "Teams", icon: "hugeicons:user-group", items: [] },
];

const openSections = reactive<Record<string, boolean>>({
  tasks: false,
  projects: false,
  teams: false,
});

const modalStore = useModalStore();

const sectionItems = computed(() => ({
  tasks: tasks.value
    .filter((t) => !t.deleted_at)
    .map((t) => ({ id: t.id, label: t.name, projectId: t.project_id })),
  projects: projects.value.filter((p) => !p.deleted_at).map((p) => ({ id: p.id, label: p.title })),
  teams: teams.value.filter((t) => !t.deleted_at).map((t) => ({ id: t.id, label: t.name })),
}));

const handleAdd = (key: string, event: Event) => {
  event.stopPropagation();
  if (key === "projects") {
    modalStore?.onOpen("addNewProject");
    modalStore?.setIsOpen(true);
  }
  if (key === "tasks") {
    modalStore?.setModalData({});
    modalStore?.onOpen("addNewTask");
    modalStore?.setIsOpen(true);
  }
};

const currentSection = computed(() => {
  const path = route.path;
  for (const section of sections) {
    if (path.includes(`/${section.key}/`)) {
      return section.key;
    }
  }
  return null;
});

watch(
  currentSection,
  (section) => {
    if (section) {
      openSections[section] = true;
    }
  },
  { immediate: true },
);

function handleViewProject(item: { id: string }, event: Event) {
  event.stopPropagation();
  navigateTo(`/workspace/${workspaceId.value}/projects/${item.id}`);
}

function handleDeleteProject(item: { id: string; label: string }, event: Event) {
  event.stopPropagation();
  modalStore?.setModalData({
    projectId: item.id,
    workspaceId: workspaceId.value,
    projectTitle: item.label,
  });
  modalStore?.onOpen("deleteProject");
  modalStore?.setIsOpen(true);
}

function handleViewTask(item: { id: string }, event: Event) {
  event.stopPropagation();
  navigateTo(`/workspace/${workspaceId.value}/tasks/${item.id}`);
}

function handleDeleteTask(item: { id: string; label: string; projectId: string }, event: Event) {
  event.stopPropagation();
  modalStore?.setModalData({
    taskId: item.id,
    taskTitle: item.label,
    projectId: item.projectId,
    workspaceId: workspaceId.value,
  });
  modalStore?.onOpen("deleteTask");
  modalStore?.setIsOpen(true);
}

function handleViewTeam(item: { id: string }, event: Event) {
  event.stopPropagation();
  console.log("view team", item.id);
}

function handleDeleteTeam(item: { id: string }, event: Event) {
  event.stopPropagation();
  console.log("delete team", item.id);
}
</script>

<template>
  <div class="space-y-2">
    <h3 class="font-ibm-plex-mono text-xs uppercase">Main Menu</h3>
    <div class="space-y-1">
      <NuxtLink
        v-slot="{ isActive, href, navigate }"
        :to="`/workspace/${workspaceId}/dashboard`"
        custom
      >
        <a
          :href="href"
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          :class="[isActive && 'bg-[#f2f2f2] dark:bg-neutral-800']"
          @click="navigate"
        >
          <Icon name="hugeicons:dashboard-square-03" size="18" />
          <p class="text-sm">Dashboard</p>
        </a>
      </NuxtLink>

      <NuxtLink
        v-slot="{ isActive, href, navigate }"
        :to="`/workspace/${workspaceId}/members`"
        custom
      >
        <a
          :href="href"
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          :class="[isActive && 'bg-[#f2f2f2] dark:bg-neutral-800']"
          @click="navigate"
        >
          <Icon name="hugeicons:user-multiple-02" size="18" />
          <p class="text-sm">Members</p>
        </a>
      </NuxtLink>

      <NuxtLink
        v-slot="{ isActive, href, navigate }"
        :to="`/workspace/${workspaceId}/calendar`"
        custom
      >
        <a
          :href="href"
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          :class="[isActive && 'bg-[#f2f2f2] dark:bg-neutral-800']"
          @click="navigate"
        >
          <Icon name="hugeicons:calendar-03" size="18" />
          <p class="text-sm">Calendar</p>
        </a>
      </NuxtLink>

      <Collapsible
        v-for="section in sections"
        :key="section.key"
        :open="openSections[section.key]"
        @update:open="(val) => (openSections[section.key] = val)"
      >
        <div
          class="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        >
          <NuxtLink
            v-slot="{ isActive, href, navigate }"
            :to="`/workspace/${workspaceId}/${section.key}/all`"
            custom
          >
            <a
              :href="href"
              class="flex flex-1 items-center space-x-2"
              :class="[isActive && 'text-primary']"
              @click="navigate"
            >
              <Icon :name="section.icon" size="18" />
              <p class="text-sm">{{ section.label }}</p>
            </a>
          </NuxtLink>
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
          <div v-if="loading" class="mt-1 ml-6 space-y-2 border-l pl-2">
            <Skeleton v-for="n in 3" :key="n" class="h-4 w-[60%]" />
          </div>
          <div v-else class="mt-1 ml-6 space-y-1 border-l pl-2">
            <NuxtLink
              v-for="item in sectionItems[section.key]"
              :key="item.id"
              v-slot="{ isActive, href, navigate }"
              class="block"
              :to="`/workspace/${workspaceId}/${section.key}/${item.id}`"
            >
              <a
                :href="href"
                class="group flex cursor-pointer items-center justify-between rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                :class="[isActive && 'bg-[#f2f2f2] dark:bg-neutral-800']"
                @click="navigate"
              >
                <span>{{ item.label }}</span>
                <Popover>
                  <PopoverTrigger as-child @click.stop.prevent>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Icon name="lucide:ellipsis" size="14" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" class="w-40 p-1">
                    <template v-if="section.key === 'projects'">
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                        @click.stop="handleViewProject(item, $event)"
                      >
                        <Icon name="lucide:eye" size="14" />
                        View
                      </button>
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        @click.stop="handleDeleteProject(item, $event)"
                      >
                        <Icon name="lucide:trash-2" size="14" />
                        Delete
                      </button>
                    </template>
                    <template v-else-if="section.key === 'tasks'">
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                        @click.stop="handleViewTask(item, $event)"
                      >
                        <Icon name="lucide:eye" size="14" />
                        View
                      </button>
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        @click.stop="handleDeleteTask(item, $event)"
                      >
                        <Icon name="lucide:trash-2" size="14" />
                        Delete
                      </button>
                    </template>
                    <template v-else-if="section.key === 'teams'">
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                        @click.stop="handleViewTeam(item, $event)"
                      >
                        <Icon name="lucide:eye" size="14" />
                        View
                      </button>
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        @click.stop="handleDeleteTeam(item, $event)"
                      >
                        <Icon name="lucide:trash-2" size="14" />
                        Delete
                      </button>
                    </template>
                  </PopoverContent>
                </Popover>
              </a>
            </NuxtLink>
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
