<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { useModalStore } from "~/stores/use-modal-store";

const props = defineProps<{
  task: TaskDocType | null;
  workspaceId: string;
  projectId: string;
}>();

const modalStore = useModalStore();

function handleDelete() {
  if (!props.task) return;
  modalStore?.setModalData({
    taskId: props.task.id,
    taskTitle: props.task.name ?? "Untitled",
    projectId: props.projectId,
    workspaceId: props.workspaceId,
  });
  modalStore?.onOpen("deleteTask");
  modalStore?.setIsOpen(true);
}

const isEditing = ref(false);
const editValue = ref("");

function startEditing() {
  editValue.value = props.task?.name ?? "";
  isEditing.value = true;
  nextTick(() => {
    const el = document.getElementById("task-title-input");
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  });
}

async function saveTitle() {
  const val = editValue.value.trim();
  if (!val || val === (props.task?.name ?? "")) {
    isEditing.value = false;
    return;
  }
  isEditing.value = false;

  const db = await useRxDbSafe();
  const doc = db ? await db.tasks.findOne(props.task!.id).exec() : null;
  if (!doc) return;

  const oldTitle = doc.get("name");
  await doc.patch({ name: val, updated_at: new Date().toISOString() });

  try {
    await $fetch(
      `/api/workspace/${props.workspaceId}/project/${props.projectId}/tasks/${props.task!.id}/update`,
      {
        method: "PATCH",
        body: { name: val },
      },
    );
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ name: oldTitle, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update title", {
        position: "top-center",
      });
    }
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    (e.target as HTMLInputElement).blur();
  }
  if (e.key === "Escape") {
    isEditing.value = false;
  }
}

const isDone = computed(
  () => props.task?.status === "completed" || props.task?.status === "abandoned",
);
</script>

<template>
  <div class="flex items-start justify-between">
    <div class="flex items-center gap-2.5">
      <div class="flex size-8 items-center justify-center rounded-md bg-muted">
        <Icon name="solar:checklist-bold-duotone" class="size-5 text-muted-foreground" />
      </div>
      <div v-if="isEditing" class="flex items-center gap-2">
        <input
          id="task-title-input"
          v-model="editValue"
          type="text"
          class="rounded-md border border-input bg-transparent px-2 py-1 text-xl font-semibold tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @blur="saveTitle"
          @keydown="onKeydown"
        />
      </div>
      <h1
        v-else
        class="cursor-pointer rounded-md px-2 py-1 text-xl font-semibold tracking-tight hover:bg-muted"
        :class="isDone && 'text-muted-foreground line-through'"
        @click="startEditing"
      >
        {{ task?.name ?? "Untitled" }}
      </h1>
    </div>

    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        class="gap-1.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
        @click="handleDelete"
      >
        <Icon name="solar:trash-bin-trash-linear" class="size-4" />
        Delete
      </Button>
    </div>
  </div>
</template>
