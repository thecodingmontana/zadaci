<script setup lang="ts">
import type { TagDocType } from "~/plugins/rxdb.client";
import type { ProjectMembers } from "~/types";
import { Loader2 } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import AddAssignee from "~/components/workspace/shared/add-assignee.vue";
import DatePicker from "~/components/workspace/shared/date-picker.vue";
import { projectMembersKey } from "~/composables/use-project-members";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { useWorkspaceStore } from "~/stores/use-workspace-store";
import { columns, newProjectSchema, priorityOptions } from "~/types";

const props = defineProps<{
  onClose: () => void;
  isAddNewProject: boolean;
  onSetIsAddNewProject: (payload: boolean) => void;
}>();

const workspaceStore = useWorkspaceStore();
const queryClient = useQueryClient();

const activeWorkspace = computed(() => {
  return workspaceStore?.activeWorkspace;
});

const workspaceIdRef = computed(() => activeWorkspace.value?.id as string | undefined);

const form = useForm({
  validationSchema: newProjectSchema,
});

const assignees = ref<ProjectMembers[]>([]);
const selectedTags = ref<string[]>([]);
const availableTags = ref<TagDocType[]>([]);

onMounted(async () => {
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

function toggleTag(tagId: string) {
  if (selectedTags.value.includes(tagId)) {
    selectedTags.value = selectedTags.value.filter((id) => id !== tagId);
  } else {
    selectedTags.value = [...selectedTags.value, tagId];
  }
}

const onAddAssiginees = (payload: ProjectMembers) => {
  assignees.value = [...assignees.value, payload];
};

const onRemoveAssignee = (payload: ProjectMembers) => {
  assignees.value = assignees.value.filter((a) => a.member_id !== payload.member_id);
};

const onCloseModal = () => {
  props?.onSetIsAddNewProject(false);
  props?.onClose();
};

const onSubmit = form.handleSubmit(async (values) => {
  if (assignees.value.length <= 0) {
    return toast.error("At least one member is required!", {
      position: "top-center",
    });
  }

  props?.onSetIsAddNewProject(true);

  const newFormValues = {
    ...values,
    description: values.description ? values.description : "",
    dueDate: values.dueDate ? new Date(values.dueDate) : undefined,
    members: assignees.value,
    tags: selectedTags.value,
  };

  const promise = $fetch(`/api/workspace/${activeWorkspace.value?.id}/project/new`, {
    method: "POST",
    body: newFormValues,
  });

  toast.promise(promise, {
    loading: "Creating project...",
    success: "Project created successfully!",
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't create project",
    desc: "Redirecting to project...",
    errorDesc: "Check the details and try again",
    position: "top-center",
  });

  promise
    .then(async (res: any) => {
      if (res?.project) {
        const db = await useRxDbSafe();
        if (db) {
          await db.projects.insert({
            id: res.project.id,
            workspace_id: res.project.workspace_id,
            title: res.project.title,
            description: res.project.description,
            status: res.project.status,
            priority: res.project.priority,
            due_date: res.project.due_date,
            created_at: res.project.created_at,
            updated_at: res.project.updated_at,
            deleted_at: null,
          });
        }

        queryClient.invalidateQueries({
          queryKey: ["sidebar_projects", activeWorkspace.value?.id],
        });
        queryClient.invalidateQueries({ queryKey: projectMembersKey(res.project.id) });

        form.resetForm();
        assignees.value = [];
        onCloseModal();

        if (res.project.id) {
          navigateTo(`/workspace/${activeWorkspace.value?.id}/projects/${res.project.id}`);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      props?.onSetIsAddNewProject(false);
    });
});
</script>

<template>
  <form class="-mt-8 space-y-2 p-2" @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="title">
      <FormItem>
        <FormControl>
          <FormMessage />
          <Textarea
            placeholder="Project title"
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
                    v-for="column in columns"
                    :key="column.name"
                    :value="column.name.toUpperCase()"
                  >
                    <Icon :name="column.icon" width="16" height="16" aria-hidden="true" />
                    <span class="truncate">
                      {{ column.name }}
                    </span>
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
                      :style="{
                        backgroundColor: priority.color,
                      }"
                    />
                    <span class="truncate">
                      {{ priority.name }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      </FormField>
      <div class="grid gap-2">
        <Label>Members</Label>
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
      <div class="grid gap-2">
        <Label>Tags</Label>
        <div class="flex flex-wrap items-center gap-2">
          <template v-if="availableTags.length === 0">
            <span class="text-xs text-muted-foreground">No tags available</span>
          </template>
          <Button
            v-for="tag in availableTags"
            :key="tag.id"
            type="button"
            variant="outline"
            size="sm"
            class="cursor-pointer gap-1.5"
            :class="[selectedTags.includes(tag.id) && 'border-primary bg-primary/10']"
            @click="toggleTag(tag.id)"
          >
            <span class="size-2 rounded-full" :style="{ backgroundColor: tag.color ?? '#888' }" />
            {{ tag.name }}
          </Button>
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
    </div>

    <div class="absolute right-0 bottom-0 left-0 rounded-b-xl p-2">
      <Button
        :disabled="props.isAddNewProject"
        class="w-full cursor-pointer bg-brand text-white capitalize hover:bg-brand-secondary"
      >
        <Loader2 v-if="props?.isAddNewProject" class="size-5 animate-spin" />
        Add new project
      </Button>
    </div>
  </form>
</template>
