<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";

import { customAlphabet } from "nanoid";
import { useRxDbSafe } from "~/composables/use-rxdb";

const genId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 16);

const projectId = ref("");
const tasks = ref<TaskDocType[]>([]);
const newTaskName = ref("");
const editingTaskId = ref<string | null>(null);
const editName = ref("");
const editStatus = ref<string>("idea");
const log = ref<string[]>([]);

const { start, stop, isActive, syncError } = useTaskSync(() =>
  projectId.value ? [projectId.value] : [],
);

function addLog(msg: string) {
  log.value.push(`${new Date().toLocaleTimeString()}: ${msg}`);
}

async function startSync() {
  if (!projectId.value) {
    addLog("Enter a project ID first");
    return;
  }
  try {
    await start();
    addLog(`Sync started for project: ${projectId.value}`);
    loadTasks();
  } catch (err: any) {
    addLog(`Sync start failed: ${err.message}`);
  }
}

function stopSync() {
  stop();
  addLog("Sync stopped");
}

async function loadTasks() {
  const db = await useRxDbSafe();
  if (!db) {
    addLog("RxDB not available yet");
    return;
  }
  try {
    const docs = await db.tasks
      .find({
        selector: {
          project_id: projectId.value,
        },
        sort: [{ created_at: "asc" }],
      })
      .exec();
    tasks.value = docs.map((d) => d.toMutableJSON());
    addLog(`Loaded ${tasks.value.length} tasks from RxDB`);
  } catch (err: any) {
    addLog(`Load failed: ${err.message}`);
  }
}

async function createTask() {
  if (!newTaskName.value.trim()) return;
  const db = await useRxDbSafe();
  if (!db) return;

  const now = new Date().toISOString();
  const task: TaskDocType = {
    id: genId(),
    name: newTaskName.value.trim(),
    description: null,
    status: "idea",
    priority: "none",
    project_id: projectId.value,
    due_date: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  try {
    await db.tasks.insert(task);
    addLog(`Created task: ${task.name}`);
    newTaskName.value = "";
    await loadTasks();
  } catch (err: any) {
    addLog(`Create failed: ${err.message}`);
  }
}

async function startEdit(task: TaskDocType) {
  editingTaskId.value = task.id;
  editName.value = task.name;
  editStatus.value = task.status;
}

async function saveEdit(taskId: string) {
  const db = await useRxDbSafe();
  if (!db) return;

  try {
    const doc = await db.tasks.findOne({ selector: { id: taskId } }).exec();
    if (doc) {
      await doc.patch({
        name: editName.value,
        status: editStatus.value as TaskDocType["status"],
        updated_at: new Date().toISOString(),
      });
      addLog(`Updated task: ${editName.value}`);
    }
    editingTaskId.value = null;
    await loadTasks();
  } catch (err: any) {
    addLog(`Update failed: ${err.message}`);
  }
}

async function deleteTask(taskId: string) {
  const db = await useRxDbSafe();
  if (!db) return;

  try {
    const doc = await db.tasks.findOne({ selector: { id: taskId } }).exec();
    if (doc) {
      await doc.patch({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      addLog(`Soft-deleted task: ${doc.get("name")}`);
    }
    await loadTasks();
  } catch (err: any) {
    addLog(`Delete failed: ${err.message}`);
  }
}

watch(syncError, (err) => {
  if (err) {
    addLog(`Sync error: ${err.message}`);
  }
});

const statuses = ["idea", "todo", "in_progress", "in_review", "completed", "abandoned"] as const;
</script>

<template>
  <div class="mx-auto max-w-3xl p-8">
    <h1 class="mb-6 text-2xl font-bold">RxDB Sync Test Page</h1>

    <div class="mb-6 rounded border p-4">
      <label class="mb-2 block font-medium">Project ID</label>
      <div class="flex gap-2">
        <input
          v-model="projectId"
          type="text"
          placeholder="Enter a project ID"
          class="flex-1 rounded border px-3 py-2"
        />
        <button
          v-if="!isActive"
          class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          @click="startSync"
        >
          Start Sync
        </button>
        <button
          v-else
          class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          @click="stopSync"
        >
          Stop Sync
        </button>
      </div>
      <p v-if="isActive" class="mt-2 text-sm text-green-600">Sync is active</p>
      <p v-if="syncError" class="mt-2 text-sm text-red-600">Error: {{ syncError.message }}</p>
    </div>

    <div class="mb-6 rounded border p-4">
      <label class="mb-2 block font-medium">New Task</label>
      <div class="flex gap-2">
        <input
          v-model="newTaskName"
          type="text"
          placeholder="Task name"
          class="flex-1 rounded border px-3 py-2"
          @keyup.enter="createTask"
        />
        <button
          class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          @click="createTask"
        >
          Create
        </button>
      </div>
    </div>

    <div class="mb-6">
      <button class="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700" @click="loadTasks">
        Refresh from RxDB
      </button>
      <span class="ml-2 text-sm text-gray-500">{{ tasks.length }} tasks</span>
    </div>

    <div class="mb-6 space-y-2">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="rounded border p-3"
        :class="{ 'opacity-50': task.deleted_at }"
      >
        <template v-if="editingTaskId === task.id">
          <input v-model="editName" type="text" class="mb-2 w-full rounded border px-2 py-1" />
          <select v-model="editStatus" class="mb-2 w-full rounded border px-2 py-1">
            <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
          </select>
          <div class="flex gap-2">
            <button
              class="rounded bg-blue-600 px-3 py-1 text-sm text-white"
              @click="saveEdit(task.id)"
            >
              Save
            </button>
            <button
              class="rounded bg-gray-400 px-3 py-1 text-sm text-white"
              @click="editingTaskId = null"
            >
              Cancel
            </button>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium" :class="{ 'line-through': task.deleted_at }">
                {{ task.name }}
              </span>
              <span class="ml-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs">
                {{ task.status }}
              </span>
              <span class="ml-1 text-xs text-gray-500">
                {{ task.priority }}
              </span>
              <span v-if="task.deleted_at" class="ml-2 text-xs text-red-500"> (deleted) </span>
            </div>
            <div class="flex gap-1">
              <button
                class="rounded bg-yellow-500 px-2 py-1 text-xs text-white"
                @click="startEdit(task)"
              >
                Edit
              </button>
              <button
                v-if="!task.deleted_at"
                class="rounded bg-red-500 px-2 py-1 text-xs text-white"
                @click="deleteTask(task.id)"
              >
                Delete
              </button>
            </div>
          </div>
        </template>
      </div>
      <div v-if="tasks.length === 0" class="py-4 text-center text-gray-400">
        No tasks yet. Create one or start sync.
      </div>
    </div>

    <details class="rounded border p-4">
      <summary class="cursor-pointer font-medium">Event Log</summary>
      <div class="mt-2 max-h-48 overflow-y-auto text-xs">
        <div v-for="(line, i) in log" :key="i" class="py-0.5 text-gray-600">
          {{ line }}
        </div>
        <div v-if="log.length === 0" class="text-gray-400">No events yet</div>
      </div>
    </details>
  </div>
</template>
