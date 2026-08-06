<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import type { TaskAssigneeDocType, TaskDocType } from "~/plugins/rxdb.client";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import AvatarGroup from "~/components/workspace/shared/avatar-group.vue";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { STATUS_TO_API } from "~/lib/task-kanban";
import { toast } from "~/lib/toast";
import { priorityOptions, taskColumns } from "~/types";

const props = defineProps<{
  task: TaskDocType | null;
  workspaceId: string;
  projectId: string;
}>();

const workspaceIdRef = computed(() => props.workspaceId);
const { data: workspaceMembers } = useWorkspaceMembers(workspaceIdRef);

const assigneeDocs = ref<TaskAssigneeDocType[]>([]);

async function startAssigneeSubscription() {
  const db = await useRxDbSafe();
  if (!db?.task_assignees) return;

  const sub = db.task_assignees
    .find({
      selector: { task_id: props.task?.id ?? "", deleted_at: null },
    })
    .$.subscribe((docs) => {
      assigneeDocs.value = docs;
    });

  onUnmounted(() => sub.unsubscribe());
}

watch(
  () => props.task?.id,
  (id) => {
    if (id) startAssigneeSubscription();
  },
  { immediate: true },
);

const assignees = computed(() => {
  const memberIds = new Set(assigneeDocs.value.map((a) => a.member_id));
  return (workspaceMembers.value ?? []).flatMap((m) => {
    if (!memberIds.has(m.id)) return [];
    return {
      name: m.user.username ?? m.user.email ?? "Unknown",
      src: m.user.profilePictureUrl ?? undefined,
    };
  });
});

const statusBadge: Record<
  TaskDocType["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  idea: {
    label: "Idea",
    bg: "bg-gray-500/10",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  },
  todo: {
    label: "Todo",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  in_progress: {
    label: "In Progress",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  in_review: {
    label: "In Review",
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  completed: {
    label: "Completed",
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
  abandoned: {
    label: "Abandoned",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const priorityStyle: Record<TaskDocType["priority"], string> = {
  urgent: "text-rose-600 dark:text-rose-400",
  high: "text-rose-500",
  medium: "text-amber-500",
  low: "text-purple-500",
  none: "text-muted-foreground",
};

function statusToKey(status: TaskDocType["status"]) {
  const map: Record<TaskDocType["status"], string> = {
    idea: "IDEA",
    todo: "TODO",
    in_progress: "IN PROGRESS",
    in_review: "IN REVIEW",
    completed: "COMPLETED",
    abandoned: "ABANDONED",
  };
  return map[status];
}

const isDone = computed(
  () => props.task?.status === "completed" || props.task?.status === "abandoned",
);

async function updateTask(patch: Partial<TaskDocType>) {
  if (!props.task) return;
  const db = await useRxDbSafe();
  const doc = db ? await db.tasks.findOne(props.task.id).exec() : null;
  if (!doc) return;

  const oldValues = Object.fromEntries(Object.keys(patch).map((k) => [k, doc.get(k as any)]));
  await doc.patch({ ...patch, updated_at: new Date().toISOString() });

  const body: Record<string, any> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) {
    const key = patch.status.toUpperCase().replace(/ /g, "_") as keyof typeof STATUS_TO_API;
    body.status = STATUS_TO_API[key];
  }
  if (patch.priority !== undefined) body.priority = patch.priority.toUpperCase();
  if (patch.due_date !== undefined) body.dueDate = patch.due_date;

  try {
    await $fetch(
      `/api/workspace/${props.workspaceId}/project/${props.projectId}/tasks/${props.task.id}/update`,
      {
        method: "PATCH",
        body,
      },
    );
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ ...oldValues, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update task", {
        position: "top-center",
      });
    }
  }
}

async function updateStatus(status: string) {
  if (status === statusToKey(props.task?.status ?? "idea")) return;
  const rxdbStatus = status.toLowerCase().replace(/ /g, "_") as TaskDocType["status"];
  await updateTask({ status: rxdbStatus });
}

async function updatePriority(priority: string) {
  const rxdbPriority = priority.toLowerCase() as TaskDocType["priority"];
  if (rxdbPriority === props.task?.priority) return;
  await updateTask({ priority: rxdbPriority });
}

const editingDescription = ref(false);
const descriptionValue = ref("");

function startEditDescription() {
  descriptionValue.value = props.task?.description ?? "";
  editingDescription.value = true;
  nextTick(() => {
    document.getElementById("task-desc-input")?.focus();
  });
}

async function saveDescription() {
  const val = descriptionValue.value.trim();
  editingDescription.value = false;
  if (val === (props.task?.description ?? "")) return;
  await updateTask({ description: val || "" });
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
  const val = toDateInput(props.task?.due_date ?? null);
  return val ? parseDate(val) : undefined;
});

const isOverdue = computed(() => {
  if (!props.task?.due_date) return false;
  if (isDone.value) return false;
  const due = new Date(props.task.due_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
});

const calendarOpen = ref(false);

async function onDateSelect(val?: DateValue) {
  if (!val) return;
  const dateStr = val.toString();
  const current = toDateInput(props.task?.due_date ?? null);
  if (dateStr === current) return;
  calendarOpen.value = false;
  await updateTask({ due_date: dateStr });
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
      <Select :model-value="statusToKey(task?.status ?? 'idea')" @update:model-value="updateStatus">
        <SelectTrigger
          class="w-fit gap-1.5 px-2 py-0.5 text-xs font-medium hover:bg-muted [&>span]:flex [&>span]:items-center [&>span]:gap-1.5"
          :class="[
            statusBadge[task?.status ?? 'idea'].bg,
            statusBadge[task?.status ?? 'idea'].text,
          ]"
        >
          <span class="size-1.5 rounded-full" :class="statusBadge[task?.status ?? 'idea'].dot" />
          <SelectValue />
          <Icon name="lucide:chevrons-up-down" class="size-3 opacity-50" />
        </SelectTrigger>
        <SelectContent
          class="[&_*[role=option]>span]:flex [&_*[role=option]>span]:gap-2 [&_*[role=option]>span>svg]:text-muted-foreground/80"
        >
          <SelectItem
            v-for="column in taskColumns"
            :key="column.name"
            :value="column.name.toUpperCase()"
          >
            <Icon :name="column.icon" width="16" height="16" aria-hidden="true" />
            <span class="truncate">{{ column.name }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Priority -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:flag-2-linear" class="size-4" />
        Priority
      </span>
      <Select
        :model-value="(task?.priority ?? 'none').toUpperCase()"
        @update:model-value="updatePriority"
      >
        <SelectTrigger
          class="w-fit gap-1.5 px-2 py-0.5 text-xs font-medium capitalize hover:bg-muted [&>span]:flex [&>span]:items-center [&>span]:gap-1.5"
          :class="priorityStyle[task?.priority ?? 'none']"
        >
          <span class="size-1.5 rounded-full" :class="priorityStyle[task?.priority ?? 'none']" />
          <SelectValue />
          <Icon name="lucide:chevrons-up-down" class="size-3 opacity-50" />
        </SelectTrigger>
        <SelectContent
          class="[&_*[role=option]>span]:flex [&_*[role=option]>span]:gap-2 [&_*[role=option]>span>svg]:text-muted-foreground/80"
        >
          <SelectItem
            v-for="priority in priorityOptions"
            :key="priority.name"
            :value="priority.value"
          >
            <div class="size-2 rounded-full" :style="{ backgroundColor: priority.color }" />
            <span class="truncate">{{ priority.name }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Assigned to -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:users-group-rounded-linear" class="size-4" />
        Assigned to
      </span>
      <div v-if="assignees.length > 0" class="px-2 py-0.5">
        <AvatarGroup :avatars="assignees" :max="5" :size="28" />
      </div>
      <span v-else class="px-2 py-0.5 text-sm text-muted-foreground">Unassigned</span>
    </div>

    <!-- Description -->
    <div class="grid grid-cols-[140px_1fr] gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:document-text-linear" class="size-4" />
        Description
      </span>
      <div v-if="editingDescription" class="w-full">
        <textarea
          id="task-desc-input"
          v-model="descriptionValue"
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
        {{ task?.description || "Add a description..." }}
      </p>
    </div>

    <!-- Due date -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:calendar-linear" class="size-4" />
        Due date
      </span>
      <Popover v-model:open="calendarOpen">
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            class="h-auto w-fit cursor-pointer gap-1.5 px-2 py-0.5 text-sm font-normal hover:bg-muted"
            :class="[isOverdue && 'text-rose-500 hover:text-rose-600']"
          >
            <span v-if="isOverdue" class="text-xs font-medium">Due</span>
            {{
              parsedDueDate
                ? parsedDueDate.toDate(getLocalTimeZone()).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "No due date"
            }}
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

    <!-- Created -->
    <div class="grid grid-cols-[140px_1fr] items-center gap-2">
      <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="solar:clock-circle-linear" class="size-4" />
        Created
      </span>
      <span class="px-2 py-0.5 text-sm text-foreground">
        {{
          task?.created_at
            ? new Date(task.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"
        }}
      </span>
    </div>
  </Motion>
</template>
