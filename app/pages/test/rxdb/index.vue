<script setup lang="ts">
import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import { customAlphabet } from "nanoid";

import { useRxDbSafe } from "~/composables/use-rxdb";

definePageMeta({
  middleware: ["authenticated"],
});

const genId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 16);

const workspaceId = ref("");
const projects = ref<ProjectDocType[]>([]);
const tasks = ref<TaskDocType[]>([]);
const newProjectTitle = ref("");
const newTaskName = ref("");
const editingProjectId = ref<string | null>(null);
const editingTaskId = ref<string | null>(null);
const editTitle = ref("");
const editTaskName = ref("");
const log = ref<string[]>([]);

const {
  start: startTaskSync,
  stop: stopTaskSync,
  isActive: tasksActive,
  syncError: tasksError,
} = useTaskSync(() => workspaceId.value || undefined);

const {
  start: startProjectSync,
  stop: stopProjectSync,
  isActive: projectsActive,
  syncError: projectsError,
} = useProjectSync(() => workspaceId.value || undefined);

function addLog(msg: string) {
  log.value.push(`${new Date().toLocaleTimeString()}: ${msg}`);
}

async function startSync() {
  if (!workspaceId.value) {
    addLog("Enter a workspace ID first");
    return;
  }
  try {
    await Promise.all([startProjectSync(), startTaskSync()]);
    addLog(`Sync started for workspace: ${workspaceId.value}`);
    await loadAll();
  } catch (err: any) {
    addLog(`Sync start failed: ${err.message}`);
  }
}

function stopAllSync() {
  stopProjectSync();
  stopTaskSync();
  addLog("Sync stopped");
}

async function loadAll() {
  const db = await useRxDbSafe();
  if (!db) {
    addLog("RxDB not available yet");
    return;
  }
  try {
    const projectDocs = await db.projects
      .find({
        selector: { workspace_id: workspaceId.value },
        sort: [{ created_at: "asc" }],
      })
      .exec();
    projects.value = projectDocs.map((d) => d.toMutableJSON());

    const taskDocs = await db.tasks
      .find({
        selector: { project_id: { $ne: "" } },
        sort: [{ created_at: "asc" }],
      })
      .exec();
    tasks.value = taskDocs.map((d) => d.toMutableJSON());

    addLog(`Loaded ${projects.value.length} projects, ${tasks.value.length} tasks from RxDB`);
  } catch (err: any) {
    addLog(`Load failed: ${err.message}`);
  }
}

async function createProject() {
  if (!newProjectTitle.value.trim()) return;
  const db = await useRxDbSafe();
  if (!db) return;

  const now = new Date().toISOString();
  const project: ProjectDocType = {
    id: genId(),
    title: newProjectTitle.value.trim(),
    description: null,
    status: "idea",
    priority: "none",
    workspace_id: workspaceId.value,
    due_date: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  try {
    await db.projects.insert(project);
    addLog(`Created project: ${project.title}`);
    newProjectTitle.value = "";
    await loadAll();
  } catch (err: any) {
    addLog(`Create failed: ${err.message}`);
  }
}

async function createTask() {
  if (!newTaskName.value.trim()) return;
  const db = await useRxDbSafe();
  if (!db) return;

  const targetProjectId = projects.value.length > 0 ? projects.value[0].id : "";
  if (!targetProjectId) {
    addLog("Create a project first");
    return;
  }

  const now = new Date().toISOString();
  const task: TaskDocType = {
    id: genId(),
    name: newTaskName.value.trim(),
    description: null,
    status: "idea",
    priority: "none",
    project_id: targetProjectId,
    due_date: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  try {
    await db.tasks.insert(task);
    addLog(`Created task: ${task.name} (project: ${targetProjectId})`);
    newTaskName.value = "";
    await loadAll();
  } catch (err: any) {
    addLog(`Create failed: ${err.message}`);
  }
}

async function startEditProject(project: ProjectDocType) {
  editingProjectId.value = project.id;
  editTitle.value = project.title;
}

async function saveProjectEdit(projectId: string) {
  const db = await useRxDbSafe();
  if (!db) return;

  try {
    const doc = await db.projects.findOne({ selector: { id: projectId } }).exec();
    if (doc) {
      await doc.patch({
        title: editTitle.value,
        updated_at: new Date().toISOString(),
      });
      addLog(`Updated project: ${editTitle.value}`);
    }
    editingProjectId.value = null;
    await loadAll();
  } catch (err: any) {
    addLog(`Update failed: ${err.message}`);
  }
}

async function deleteProject(projectId: string) {
  const db = await useRxDbSafe();
  if (!db) return;

  try {
    const doc = await db.projects.findOne({ selector: { id: projectId } }).exec();
    if (doc) {
      await doc.patch({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      addLog(`Soft-deleted project: ${doc.get("title")}`);
    }
    await loadAll();
  } catch (err: any) {
    addLog(`Delete failed: ${err.message}`);
  }
}

async function startEditTask(task: TaskDocType) {
  editingTaskId.value = task.id;
  editTaskName.value = task.name;
}

async function saveTaskEdit(taskId: string) {
  const db = await useRxDbSafe();
  if (!db) return;

  try {
    const doc = await db.tasks.findOne({ selector: { id: taskId } }).exec();
    if (doc) {
      await doc.patch({
        name: editTaskName.value,
        updated_at: new Date().toISOString(),
      });
      addLog(`Updated task: ${editTaskName.value}`);
    }
    editingTaskId.value = null;
    await loadAll();
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
    await loadAll();
  } catch (err: any) {
    addLog(`Delete failed: ${err.message}`);
  }
}

watch([tasksError, projectsError], ([te, pe]) => {
  if (te) addLog(`Task sync error: ${te.message}`);
  if (pe) addLog(`Project sync error: ${pe.message}`);
});
</script>

<template>
  <div class="mx-auto max-w-4xl p-8">
    <h1 class="mb-6 text-2xl font-bold">RxDB Sync Test — Workspace Scope</h1>

    <div class="mb-6 rounded border p-4">
      <label class="mb-2 block font-medium">Workspace ID</label>
      <div class="flex gap-2">
        <input
          v-model="workspaceId"
          type="text"
          placeholder="Enter a workspace ID"
          class="flex-1 rounded border px-3 py-2"
        />
        <button
          v-if="!tasksActive && !projectsActive"
          class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          @click="startSync"
        >
          Start Sync
        </button>
        <button
          v-else
          class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          @click="stopAllSync"
        >
          Stop Sync
        </button>
      </div>
      <div class="mt-1 flex gap-3 text-sm">
        <span :class="tasksActive ? 'text-green-600' : 'text-gray-400'">
          Tasks: {{ tasksActive ? "active" : "off" }}
        </span>
        <span :class="projectsActive ? 'text-green-600' : 'text-gray-400'">
          Projects: {{ projectsActive ? "active" : "off" }}
        </span>
      </div>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-4">
      <div class="rounded border p-4">
        <label class="mb-2 block font-medium">New Project</label>
        <div class="flex gap-2">
          <input
            v-model="newProjectTitle"
            type="text"
            placeholder="Project title"
            class="flex-1 rounded border px-3 py-2"
            @keyup.enter="createProject"
          />
          <button
            class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            @click="createProject"
          >
            Create
          </button>
        </div>
      </div>

      <div class="rounded border p-4">
        <label class="mb-2 block font-medium">New Task</label>
        <div class="flex gap-2">
          <input
            v-model="newTaskName"
            type="text"
            placeholder="Task name (first project)"
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
    </div>

    <div class="mb-6">
      <button class="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700" @click="loadAll">
        Refresh from RxDB
      </button>
      <span class="ml-2 text-sm text-gray-500">
        {{ projects.length }} projects, {{ tasks.length }} tasks
      </span>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-6">
      <div>
        <h2 class="mb-2 text-lg font-semibold">Projects</h2>
        <div class="space-y-2">
          <div
            v-for="project in projects"
            :key="project.id"
            class="rounded border p-3"
            :class="{ 'opacity-50': project.deleted_at }"
          >
            <template v-if="editingProjectId === project.id">
              <input v-model="editTitle" type="text" class="mb-2 w-full rounded border px-2 py-1" />
              <div class="flex gap-2">
                <button
                  class="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                  @click="saveProjectEdit(project.id)"
                >
                  Save
                </button>
                <button
                  class="rounded bg-gray-400 px-3 py-1 text-sm text-white"
                  @click="editingProjectId = null"
                >
                  Cancel
                </button>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium" :class="{ 'line-through': project.deleted_at }">
                    {{ project.title }}
                  </span>
                  <span v-if="project.deleted_at" class="ml-2 text-xs text-red-500">
                    (deleted)
                  </span>
                </div>
                <div class="flex gap-1">
                  <button
                    class="rounded bg-yellow-500 px-2 py-1 text-xs text-white"
                    @click="startEditProject(project)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="!project.deleted_at"
                    class="rounded bg-red-500 px-2 py-1 text-xs text-white"
                    @click="deleteProject(project.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div v-if="projects.length === 0" class="py-4 text-center text-gray-400">
            No projects yet
          </div>
        </div>
      </div>

      <div>
        <h2 class="mb-2 text-lg font-semibold">Tasks</h2>
        <div class="space-y-2">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="rounded border p-3"
            :class="{ 'opacity-50': task.deleted_at }"
          >
            <template v-if="editingTaskId === task.id">
              <input
                v-model="editTaskName"
                type="text"
                class="mb-2 w-full rounded border px-2 py-1"
              />
              <div class="flex gap-2">
                <button
                  class="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                  @click="saveTaskEdit(task.id)"
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
                  <span class="ml-1 text-xs text-gray-500">
                    project: {{ task.project_id.slice(0, 8) }}...
                  </span>
                  <span v-if="task.deleted_at" class="ml-2 text-xs text-red-500"> (deleted) </span>
                </div>
                <div class="flex gap-1">
                  <button
                    class="rounded bg-yellow-500 px-2 py-1 text-xs text-white"
                    @click="startEditTask(task)"
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
          <div v-if="tasks.length === 0" class="py-4 text-center text-gray-400">No tasks yet</div>
        </div>
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
