<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import type { TagDocType } from "~/plugins/rxdb.client";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import AvatarGroup from "~/components/workspace/shared/avatar-group.vue";
import { useProjectMembers } from "~/composables/use-project-members";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";

const props = defineProps<{
  projectId: string;
  workspaceId: string;
  status: { label: string; dot: string; text: string; bg: string };
  description: string | null;
  timeline: { start: string; end: string };
  milestones: { completed: number; total: number };
  milestoneProgress: number;
  projectStatus: string;
  projectDueDate: string | null;
}>();

const statusOptions = [
  { value: "IDEA", label: "Idea", icon: "hugeicons:ai-idea" },
  { value: "TODO", label: "Todo", icon: "solar:clipboard-outline" },
  { value: "IN_PROGRESS", label: "In Progress", icon: "solar:alarm-outline" },
  { value: "IN_REVIEW", label: "In Review", icon: "solar:minimalistic-magnifer-bug-outline" },
  { value: "COMPLETED", label: "Completed", icon: "solar:check-circle-outline" },
  { value: "ABANDONED", label: "Abandoned", icon: "solar:trash-bin-trash-outline" },
];

const workspaceIdRef = computed(() => props.workspaceId);
const projectIdRef = computed(() => props.projectId);
const { data: projectMembers } = useProjectMembers(workspaceIdRef, projectIdRef);

const assignees = computed(() => {
  return (projectMembers.value ?? []).map((m: any) => ({
    name: m.username ?? "Unknown",
    src: m.avatar ?? undefined,
  }));
});

const projectTags = ref<{ id: string; name: string; color: string | null }[]>([]);
const availableTags = ref<TagDocType[]>([]);
const tagSearch = ref("");
const tagsPopoverOpen = ref(false);

async function refreshProjectTags() {
  try {
    const data = await $fetch<{ id: string; name: string; color: string | null }[]>(
      `/api/workspace/${props.workspaceId}/project/${props.projectId}/tags`,
    );
    projectTags.value = data;
  } catch {
    // tags unavailable
  }
}

onMounted(async () => {
  refreshProjectTags();
  const database = await useRxDbSafe();
  if (!database?.tags || !workspaceIdRef.value) return;
  database.tags
    .find({
      selector: { workspace_id: workspaceIdRef.value, deleted_at: null },
    })
    .$.subscribe((docs) => {
      availableTags.value = docs;
    });
});

function isProjectTagAttached(tagId: string) {
  return projectTags.value.some((t) => t.id === tagId);
}

async function toggleProjectTag(tagId: string) {
  const attached = isProjectTagAttached(tagId);
  const tag = availableTags.value.find((t) => t.id === tagId);

  if (attached) {
    projectTags.value = projectTags.value.filter((t) => t.id !== tagId);
  } else if (tag) {
    projectTags.value = [...projectTags.value, { id: tag.id, name: tag.name, color: tag.color }];
  } else {
    return;
  }

  try {
    if (attached) {
      await $fetch(`/api/workspace/${props.workspaceId}/project/${props.projectId}/tags/${tagId}`, {
        method: "DELETE",
      });
    } else {
      await $fetch(`/api/workspace/${props.workspaceId}/project/${props.projectId}/tags`, {
        method: "POST",
        body: { tagIds: [tagId] },
      });
    }
  } catch (err: any) {
    refreshProjectTags();
    toast.error(err?.response?._data?.statusMessage ?? "Failed to update tags", {
      position: "top-center",
    });
  }
}

async function handleCreateTag() {
  const name = tagSearch.value.trim();
  if (!name) return;
  try {
    const tag = await $fetch<any>(`/api/workspace/${props.workspaceId}/tags`, {
      method: "POST",
      body: { name },
    });
    const db = await useRxDbSafe();
    if (db) {
      await db.tags.insert({
        id: tag.id,
        workspace_id: tag.workspace_id,
        name: tag.name,
        color: tag.color,
        created_at: tag.created_at,
        updated_at: tag.updated_at,
        deleted_at: null,
      });
    }
    if (!isProjectTagAttached(tag.id)) {
      projectTags.value = [...projectTags.value, tag];
    }
    tagSearch.value = "";
    try {
      await $fetch(`/api/workspace/${props.workspaceId}/project/${props.projectId}/tags`, {
        method: "POST",
        body: { tagIds: [tag.id] },
      });
    } catch {
      refreshProjectTags();
    }
  } catch (err: any) {
    toast.error(err?.response?._data?.statusMessage ?? "Failed to create tag", {
      position: "top-center",
    });
  }
}

const currentStatus = computed(() => props.projectStatus.toUpperCase());

async function updateStatus(newStatus: string) {
  const db = await useRxDbSafe();
  const doc = db ? await db.projects.findOne(props.projectId).exec() : null;
  if (!doc) return;
  const old = doc.get("status");
  await doc.patch({ status: newStatus.toLowerCase(), updated_at: new Date().toISOString() });
  try {
    await $fetch(`/api/workspace/${props.workspaceId}/project/${props.projectId}/update-status`, {
      method: "PATCH",
      body: { status: newStatus },
    });
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ status: old, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update status", {
        position: "top-center",
      });
    }
  }
}

const editingDescription = ref(false);
const editDescriptionValue = ref("");

function startEditDescription() {
  editDescriptionValue.value = props.description ?? "";
  editingDescription.value = true;
  nextTick(() => {
    const el = document.getElementById("desc-input");
    el?.focus();
  });
}

async function saveDescription() {
  const val = editDescriptionValue.value.trim();
  if (val === (props.description ?? "")) {
    editingDescription.value = false;
    return;
  }
  editingDescription.value = false;

  const db = await useRxDbSafe();
  const doc = db ? await db.projects.findOne(props.projectId).exec() : null;
  if (!doc) return;
  const old = doc.get("description");
  await doc.patch({ description: val || "", updated_at: new Date().toISOString() });
  try {
    await $fetch(`/api/workspace/${props.workspaceId}/project/${props.projectId}/update`, {
      method: "PATCH",
      body: { description: val || "" },
    });
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ description: old, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update description", {
        position: "top-center",
      });
    }
  }
}

function onDescKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    editingDescription.value = false;
  }
}

function toDateInput(iso: string | null): string | undefined {
  if (!iso) return undefined;
  try {
    return iso.slice(0, 10);
  } catch {
    return undefined;
  }
}

const parsedDueDate = computed<DateValue | undefined>(() => {
  const val = toDateInput(props.projectDueDate);
  return val ? parseDate(val) : undefined;
});

const isOverdue = computed(() => {
  if (!props.projectDueDate) return false;
  const s = props.projectStatus.toLowerCase();
  if (s === "completed" || s === "abandoned") return false;
  const due = new Date(props.projectDueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
});

const calendarOpen = ref(false);

async function onDateSelect(val?: DateValue) {
  if (!val) return;
  const dateStr = val.toString();
  const currentDate = toDateInput(props.projectDueDate);
  if (dateStr === currentDate) return;
  calendarOpen.value = false;
  const db = await useRxDbSafe();
  const doc = db ? await db.projects.findOne(props.projectId).exec() : null;
  if (!doc) return;
  const old = doc.get("due_date");
  await doc.patch({ due_date: dateStr, updated_at: new Date().toISOString() });
  try {
    await $fetch(`/api/workspace/${props.workspaceId}/project/${props.projectId}/update`, {
      method: "PATCH",
      body: { dueDate: dateStr },
    });
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ due_date: old, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update due date", {
        position: "top-center",
      });
    }
  }
}
</script>

<template>
  <Motion
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :transition="{ duration: 0.3, delay: 0.1 }"
    class="flex flex-col gap-4"
  >
    <!-- Status -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:flag-2-linear" class="size-4" />
        Status
      </span>
      <Select :model-value="currentStatus" @update:model-value="updateStatus">
        <SelectTrigger
          class="w-fit gap-1.5 px-2 py-0.5 text-xs font-medium hover:bg-muted [&>span]:flex [&>span]:items-center [&>span]:gap-1.5"
          :class="[status.bg, status.text]"
        >
          <span class="size-1.5 rounded-full" :class="status.dot" />
          <SelectValue />
          <Icon name="lucide:chevrons-up-down" class="size-3 opacity-50" />
        </SelectTrigger>
        <SelectContent
          class="[&_*[role=option]>span]:flex [&_*[role=option]>span]:gap-2 [&_*[role=option]>span>svg]:text-muted-foreground/80"
        >
          <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            <Icon :name="opt.icon" width="16" height="16" aria-hidden="true" />
            <span class="truncate">{{ opt.label }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Description -->
    <div class="grid grid-cols-[140px_1fr] gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:document-text-linear" class="size-4" />
        Description
      </span>
      <div v-if="editingDescription" class="w-full">
        <textarea
          id="desc-input"
          v-model="editDescriptionValue"
          class="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1 text-sm leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
          rows="3"
          @blur="saveDescription"
          @keydown="onDescKeydown"
        />
      </div>
      <p
        v-else
        class="cursor-pointer rounded-md px-2 py-1 text-sm leading-relaxed text-foreground hover:bg-muted"
        @click="startEditDescription"
      >
        {{ description || "Add a description..." }}
      </p>
    </div>

    <!-- Assigned to -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:users-group-rounded-linear" class="size-4" />
        Assigned to
      </span>
      <AvatarGroup :avatars="assignees" :max="5" :size="28" />
    </div>

    <!-- Tags -->
    <div class="grid grid-cols-[140px_1fr] items-start gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:tag-linear" class="size-4" />
        Tags
      </span>
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          v-for="tag in projectTags"
          :key="tag.id"
          class="group inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
          :style="{
            backgroundColor: `${tag.color ?? '#888'}20`,
            color: tag.color ?? '#888',
          }"
        >
          <span class="size-1.5 rounded-full" :style="{ backgroundColor: tag.color ?? '#888' }" />
          {{ tag.name }}
          <button
            type="button"
            class="ml-0.5 cursor-pointer leading-none opacity-0 transition-opacity group-hover:opacity-70 hover:opacity-70 focus:opacity-100"
            aria-label="Remove tag"
            @click="toggleProjectTag(tag.id)"
          >
            <Icon name="lucide:x" size="12" />
          </button>
        </span>
        <Popover v-model:open="tagsPopoverOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              role="combobox"
              class="h-6 cursor-pointer gap-1 rounded-md px-2 text-xs font-normal hover:bg-muted"
            >
              <Icon name="lucide:plus" size="12" />
              {{ projectTags.length > 0 ? "Add" : "Add tag" }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-56 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create tag..."
                @update:model-value="(val: string) => (tagSearch = val)"
              />
              <CommandList>
                <CommandEmpty>
                  <button
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-primary hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                    @click="handleCreateTag"
                  >
                    <Icon name="lucide:plus" size="14" />
                    Create "{{ tagSearch }}"
                  </button>
                </CommandEmpty>
                <CommandGroup heading="Tags">
                  <CommandItem
                    v-for="tag in availableTags"
                    :key="tag.id"
                    :value="tag"
                    class="cursor-pointer"
                    @select="toggleProjectTag(tag.id)"
                  >
                    <span
                      class="size-2 rounded-full"
                      :style="{ backgroundColor: tag.color ?? '#888' }"
                    />
                    <span class="leading-none">{{ tag.name }}</span>
                    <Icon
                      v-if="isProjectTagAttached(tag.id)"
                      name="lucide:check"
                      size="16"
                      class="ml-auto"
                    />
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>

    <!-- Timeline -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:calendar-linear" class="size-4" />
        Timeline
      </span>
      <Popover v-model:open="calendarOpen">
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            class="h-auto w-fit cursor-pointer gap-1.5 px-2 py-0.5 text-sm font-normal hover:bg-muted"
            :class="[isOverdue && 'text-rose-500 hover:text-rose-600']"
          >
            <span v-if="isOverdue" class="text-xs font-medium">Due</span>
            {{ timeline.start }} - {{ timeline.end }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-fit p-0" align="start">
          <div class="[&_table]:w-fit">
            <Calendar
              :model-value="parsedDueDate"
              :min-value="today(getLocalTimeZone())"
              initial-focus
              @update:model-value="onDateSelect"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <!-- Milestones -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:flag-linear" class="size-4" />
        Milestones
      </span>
      <div class="flex items-center gap-3">
        <div class="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
          <Motion
            as="div"
            class="h-full rounded-full bg-green-500"
            :initial="{ width: '0%' }"
            :animate="{ width: `${milestoneProgress}%` }"
            :transition="{ duration: 0.6, ease: 'easeOut', delay: 0.2 }"
          />
        </div>
        <span class="text-xs text-muted-foreground">
          {{ milestones.completed }}/{{ milestones.total }} Completed
        </span>
      </div>
    </div>
  </Motion>
</template>
