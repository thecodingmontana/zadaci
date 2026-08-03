<script setup lang="ts">
import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import type { ProjectMembers } from "~/types";
import { Check, ChevronDown, Loader2, X } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import AddAssignee from "~/components/workspace/shared/add-assignee.vue";
import AvatarGroup from "~/components/workspace/shared/avatar-group.vue";
import DatePicker from "~/components/workspace/shared/date-picker.vue";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { useWorkspaceStore } from "~/stores/use-workspace-store";
import { newTaskSchema, priorityOptions, taskColumns } from "~/types";

const props = defineProps<{
  onClose: () => void;
  isAddNewTask: boolean;
  onSetIsAddNewTask: (payload: boolean) => void;
  projectId: string | null;
}>();

const workspaceStore = useWorkspaceStore();
const queryClient = useQueryClient();

const activeWorkspace = computed(() => workspaceStore?.activeWorkspace);
const workspaceIdRef = computed(() => activeWorkspace.value?.id as string | undefined);

const form = useForm({
  validationSchema: newTaskSchema,
});

const projects = ref<ProjectDocType[]>([]);
const selectedProjectId = ref<string | null>(props.projectId);

onMounted(async () => {
  const database = await useRxDbSafe();
  if (!database?.projects || !workspaceIdRef.value) return;
  database.projects
    .find({
      selector: { workspace_id: workspaceIdRef.value, deleted_at: null },
    })
    .$.subscribe((docs) => {
      projects.value = docs;
    });
});

const selectedProject = computed(
  () => projects.value.find((p) => p.id === selectedProjectId.value) ?? null,
);

const assignees = ref<ProjectMembers[]>([]);

const onAddAssiginees = (payload: ProjectMembers) => {
  if (assignees.value.some((a) => a.member_id === payload.member_id)) return;
  assignees.value = [...assignees.value, payload];
};

const onRemoveAssignee = (payload: ProjectMembers) => {
  assignees.value = assignees.value.filter((a) => a.member_id !== payload.member_id);
};

const subtasks = ref([{ name: "", is_completed: false }]);

const onSubtaskInput = (index: number, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim();

  if (event.key === "Enter") {
    event.preventDefault();
    if (value === "") {
      toast.error("Subtask name cannot be empty.", { position: "top-center" });
      return;
    }
    if (index === subtasks.value.length - 1) {
      subtasks.value.push({ name: "", is_completed: false });
    }
  }
};

const removeSubtask = (index: number) => {
  subtasks.value.splice(index, 1);
  if (subtasks.value.length === 0) {
    subtasks.value.push({ name: "", is_completed: false });
  }
};

watch(
  subtasks,
  (newVal) => {
    form.setFieldValue("subtasks", newVal);
  },
  { deep: true },
);

function normalizeTask(doc: any): TaskDocType {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    status: doc.status,
    priority: doc.priority,
    project_id: doc.project_id,
    parent_task_id: doc.parent_task_id ?? null,
    due_date: doc.due_date ? new Date(doc.due_date).toISOString() : null,
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString(),
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : new Date().toISOString(),
    deleted_at: null,
  };
}

const onCloseModal = () => {
  props?.onSetIsAddNewTask(false);
  props?.onClose();
};

const onSubmit = form.handleSubmit(async (values) => {
  if (!selectedProjectId.value) {
    return toast.error("Please select a project!", { position: "top-center" });
  }
  if (assignees.value.length <= 0) {
    return toast.error("At least one assigned member is required!", { position: "top-center" });
  }

  props?.onSetIsAddNewTask(true);

  const newFormValues = {
    ...values,
    description: values.description ? values.description : "",
    dueDate: values.dueDate ? new Date(values.dueDate) : undefined,
    assignees: assignees.value,
    subtasks: subtasks.value.filter((sub) => sub.name.trim()),
  };

  const promise = $fetch(
    `/api/workspace/${workspaceIdRef.value}/project/${selectedProjectId.value}/tasks/add`,
    {
      method: "POST",
      body: newFormValues,
    },
  );

  toast.promise(promise, {
    loading: "Creating task...",
    success: (data: any) => data?.message ?? "Task created successfully!",
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't create task",
    desc: "Adding task...",
    errorDesc: "Check the details and try again",
    position: "top-center",
  });

  promise
    .then(async (res: any) => {
      const db = await useRxDbSafe();
      if (db) {
        const toInsert: TaskDocType[] = [];
        if (res?.task) toInsert.push(normalizeTask(res.task));
        if (Array.isArray(res?.subtasks)) {
          for (const sub of res.subtasks) toInsert.push(normalizeTask(sub));
        }
        for (const task of toInsert) {
          await db.tasks.upsert(task);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["sidebar_tasks"] });

      form.resetForm();
      assignees.value = [];
      subtasks.value = [{ name: "", is_completed: false }];
      onCloseModal();
    })
    .catch(() => {})
    .finally(() => {
      props?.onSetIsAddNewTask(false);
    });
});
</script>

<template>
  <form class="flex flex-1 flex-col overflow-hidden" @submit="onSubmit">
    <div class="flex-1 space-y-2 overflow-y-auto p-2">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormControl>
            <FormMessage />
            <Textarea
              placeholder="Task name"
              class="resize-none border-0 !text-xl shadow-none outline-none placeholder:text-xl focus-visible:ring-0 dark:bg-transparent"
              v-bind="componentField"
              @input="
                (e: Event) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }
              "
            />
          </FormControl>
        </FormItem>
      </FormField>

      <div class="grid gap-3 px-2">
        <div class="grid grid-cols-2">
          <Label> Project </Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                role="combobox"
                class="w-full cursor-pointer justify-between bg-background px-3 font-normal hover:bg-background dark:border dark:border-ring"
              >
                <span class="flex items-center gap-2 truncate">
                  <Icon name="solar:folder-2-linear" class="size-4 shrink-0" />
                  <span class="truncate">
                    {{ selectedProject?.title ?? "Select project" }}
                  </span>
                </span>
                <ChevronDown
                  :size="16"
                  :stroke-width="2"
                  class="shrink-0 text-muted-foreground/80"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              class="w-full min-w-[var(--reka-popper-anchor-width)] p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search projects..." />
                <CommandList>
                  <CommandEmpty>No projects found.</CommandEmpty>
                  <CommandGroup heading="Projects">
                    <CommandItem
                      v-for="project in projects"
                      :key="project.id"
                      :value="project"
                      class="cursor-pointer"
                      @select="selectedProjectId = project.id"
                    >
                      <Icon name="solar:folder-2-linear" class="size-4" />
                      <span class="flex-1 truncate leading-none">{{ project.title }}</span>
                      <Check
                        v-if="selectedProjectId === project.id"
                        :size="16"
                        stroke-width="2"
                        class="ml-auto shrink-0"
                      />
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <FormField v-slot="{ componentField }" name="status">
          <FormItem>
            <div class="grid grid-cols-2">
              <FormLabel> Status </FormLabel>
              <FormControl>
                <Select v-bind="componentField">
                  <SelectTrigger
                    class="w-full [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span_svg]:shrink-0 [&>span_svg]:text-muted-foreground/80"
                  >
                    <SelectValue placeholder="Select status" />
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
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="dueDate">
          <FormItem>
            <div class="grid grid-cols-2">
              <FormLabel> Due date </FormLabel>
              <FormControl>
                <DatePicker v-bind="componentField" />
              </FormControl>
            </div>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="priority">
          <FormItem>
            <div class="grid grid-cols-2">
              <FormLabel> Priority </FormLabel>
              <FormControl>
                <Select v-bind="componentField">
                  <SelectTrigger
                    class="w-full [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span_svg]:shrink-0 [&>span_svg]:text-muted-foreground/80"
                  >
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent
                    class="[&_*[role=option]>span]:flex [&_*[role=option]>span]:gap-2 [&_*[role=option]>span>svg]:text-muted-foreground/80"
                  >
                    <SelectItem
                      v-for="priority in priorityOptions"
                      :key="priority.name"
                      :value="priority.value"
                    >
                      <div
                        class="size-2 rounded-full"
                        :style="{ backgroundColor: priority.color }"
                      />
                      <span class="truncate">{{ priority.name }}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="grid gap-2">
          <Label>Assignees</Label>
          <div class="grid gap-y-2">
            <div v-if="assignees.length > 0">
              <AvatarGroup
                :avatars="assignees.map((a) => ({ name: a.username, src: a.avatar ?? undefined }))"
                :max="10"
                :size="40"
                removable
                @remove="
                  (item) => {
                    const member = assignees.find((a) => a.username === item.name);
                    if (member) onRemoveAssignee(member);
                  }
                "
              />
            </div>
            <AddAssignee
              :assignees="assignees"
              :on-add-assiginees="onAddAssiginees"
              :on-remove-assignee="onRemoveAssignee"
            />
          </div>
        </div>

        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <div class="grid gap-2">
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  v-bind="componentField"
                  class="h-24 max-h-24 min-h-24 resize-none overflow-y-auto dark:border dark:border-ring"
                />
              </FormControl>
            </div>
          </FormItem>
        </FormField>

        <div class="grid gap-2">
          <Label>Subtasks</Label>
          <div v-for="(subtask, index) in subtasks" :key="index" class="flex items-center gap-x-2">
            <Checkbox
              v-model:checked="subtask.is_completed"
              class="size-5 rounded border-zinc-300"
              @update:model-value="(value) => (subtask.is_completed = value === true)"
            />
            <Input
              v-model="subtask.name"
              class="flex-1 border-0 shadow-none outline-none focus-visible:ring-0 dark:bg-transparent"
              placeholder="Add subtask"
              @keydown.enter="onSubtaskInput(index, $event)"
            />
            <button
              v-if="subtasks.length - 1 !== index"
              type="button"
              class="cursor-pointer text-red-500 hover:text-red-700"
              @click="removeSubtask(index)"
            >
              <X :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-b-xl p-2">
      <Button
        :disabled="props.isAddNewTask"
        class="w-full cursor-pointer bg-brand text-white capitalize hover:bg-brand-secondary"
      >
        <Loader2 v-if="props?.isAddNewTask" class="size-5 animate-spin" />
        Add new task
      </Button>
    </div>
  </form>
</template>
