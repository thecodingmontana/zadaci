<script setup lang="ts">
import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import { customAlphabet } from "nanoid";

import { useRxDbSafe } from "~/composables/use-rxdb";
console.log("[debug] QUERY CODE VERSION 3");

definePageMeta({
  middleware: ["authenticated"],
  robots: { index: false },
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
let projectsSub: { unsubscribe: () => void } | null = null;
let tasksSub: { unsubscribe: () => void } | null = null;

const {
  start: startTaskSync,
  stop: stopTaskSync,
  isActive: tasksActive,
  syncError: tasksError,
  realtimeStatus: tasksRealtimeStatus,
} = useTaskSync(() => workspaceId.value || undefined);

const {
  start: startProjectSync,
  stop: stopProjectSync,
  isActive: projectsActive,
  syncError: projectsError,
  realtimeStatus: projectsRealtimeStatus,
} = useProjectSync(() => workspaceId.value || undefined);

const online = ref(typeof navigator !== "undefined" ? navigator.onLine : true);

if (import.meta.client) {
  const onOnline = () => {
    online.value = true;
  };
  const onOffline = () => {
    online.value = false;
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  onUnmounted(() => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  });
}

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
    await setupSubscriptions();
  } catch (err: any) {
    addLog(`Sync start failed: ${err.message}`);
  }
}

function stopAllSync() {
  teardownSubscriptions();
  stopProjectSync();
  stopTaskSync();
  addLog("Sync stopped");
}

async function setupSubscriptions() {
  const db = await useRxDbSafe();
  if (!db) {
    addLog("RxDB not available yet");
    return;
  }

  teardownSubscriptions();

  try {
    const projectSelector = { workspace_id: workspaceId.value };
    const taskSelector = {};

    console.log("[debug] project selector:", JSON.stringify(projectSelector));
    console.log("[debug] task selector:", JSON.stringify(taskSelector));

    // Unfiltered diagnostic queries
    const allProjects = await db.projects.find().exec();
    console.log("[debug] ALL projects count:", allProjects.length);
    allProjects.forEach((p) => {
      const raw = p.toMutableJSON();
      console.log(
        "[debug]   project:",
        raw.id,
        "title:",
        raw.title,
        "deleted_at:",
        raw.deleted_at,
        "deleted_at type:",
        typeof raw.deleted_at,
        "has deleted_at key:",
        "deleted_at" in raw,
        "_deleted:",
        raw._deleted,
        "all keys:",
        Object.keys(raw),
      );
    });

    const allTasks = await db.tasks.find().exec();
    console.log("[debug] ALL tasks count:", allTasks.length);
    allTasks.forEach((t) => {
      const raw = t.toMutableJSON();
      console.log(
        "[debug]   task:",
        raw.id,
        "name:",
        raw.name,
        "deleted_at:",
        raw.deleted_at,
        "deleted_at type:",
        typeof raw.deleted_at,
        "has deleted_at key:",
        "deleted_at" in raw,
        "_deleted:",
        raw._deleted,
        "all keys:",
        Object.keys(raw),
      );
    });

    // Filtered diagnostic queries
    const filteredProjects = await db.projects.find({ selector: projectSelector }).exec();
    console.log("[debug] FILTERED projects count (by workspace only):", filteredProjects.length);

    const filteredTasks = await db.tasks.find({ selector: taskSelector }).exec();
    console.log("[debug] FILTERED tasks count (no filter):", filteredTasks.length);

    // Check for RxDB query errors by testing $eq: null directly
    try {
      const nullTest = await db.projects.find({ selector: { deleted_at: { $eq: null } } }).exec();
      console.log("[debug] $eq:null test projects count:", nullTest.length);
    } catch (e: any) {
      console.log("[debug] $eq:null query ERROR:", e.message);
    }

    const projectQuery = db.projects.find({
      selector: projectSelector,
      sort: [{ created_at: "asc" }],
    });

    projectsSub = projectQuery.$.subscribe((docs) => {
      const filtered = docs.filter((d) => !d.toMutableJSON().deleted_at);
      console.log("[debug] project sub fired - total:", docs.length, "filtered:", filtered.length);
      projects.value = filtered.map((d) => d.toMutableJSON());
    });

    const taskQuery = db.tasks.find({
      sort: [{ created_at: "asc" }],
    });

    tasksSub = taskQuery.$.subscribe((docs) => {
      const filtered = docs.filter((d) => !d.toMutableJSON().deleted_at);
      console.log("[debug] task sub fired - total:", docs.length, "filtered:", filtered.length);
      tasks.value = filtered.map((d) => d.toMutableJSON());
    });

    addLog("RxDB subscriptions active");
  } catch (err: any) {
    addLog(`Subscription setup failed: ${err.message}`);
  }
}

function teardownSubscriptions() {
  if (projectsSub) {
    projectsSub.unsubscribe();
    projectsSub = null;
  }
  if (tasksSub) {
    tasksSub.unsubscribe();
    tasksSub = null;
  }
}

async function loadAll() {
  addLog("Refresh button is no longer needed — using reactive subscriptions");
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
      const now = new Date().toISOString();
      await doc.incrementalModify((oldData: any) => ({
        ...oldData,
        deleted_at: now,
        updated_at: now,
      }));
      console.log(
        "[rxdb-debug] project delete - id:",
        projectId,
        "deleted_at:",
        doc.get("deleted_at"),
        "doc:",
        doc.toMutableJSON(),
      );
      addLog(`Soft-deleted project: ${doc.get("title")}`);
    }
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
      const now = new Date().toISOString();
      await doc.incrementalModify((oldData: any) => ({
        ...oldData,
        deleted_at: now,
        updated_at: now,
      }));
      console.log(
        "[rxdb-debug] task delete - id:",
        taskId,
        "deleted_at:",
        doc.get("deleted_at"),
        "doc:",
        doc.toMutableJSON(),
      );
      addLog(`Soft-deleted task: ${doc.get("name")}`);
    }
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
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block size-2 rounded-full"
            :class="online ? 'bg-green-500' : 'bg-red-500'"
          />
          {{ online ? "Online" : "Offline" }}
        </span>

        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block size-2 rounded-full"
            :style="{
              backgroundColor:
                projectsRealtimeStatus === 'SUBSCRIBED'
                  ? '#22c55e'
                  : projectsRealtimeStatus === 'CHANNEL_ERROR' ||
                      projectsRealtimeStatus === 'TIMED_OUT'
                    ? '#ef4444'
                    : '#eab308',
            }"
          />
          RT Projects: {{ projectsRealtimeStatus }}
        </span>

        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block size-2 rounded-full"
            :style="{
              backgroundColor:
                tasksRealtimeStatus === 'SUBSCRIBED'
                  ? '#22c55e'
                  : tasksRealtimeStatus === 'CHANNEL_ERROR' || tasksRealtimeStatus === 'TIMED_OUT'
                    ? '#ef4444'
                    : '#eab308',
            }"
          />
          RT Tasks: {{ tasksRealtimeStatus }}
        </span>

        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block size-2 rounded-full"
            :class="projectsActive ? 'bg-green-500' : 'bg-gray-400'"
          />
          Sync Projects: {{ projectsActive ? "active" : "off" }}
        </span>

        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block size-2 rounded-full"
            :class="tasksActive ? 'bg-green-500' : 'bg-gray-400'"
          />
          Sync Tasks: {{ tasksActive ? "active" : "off" }}
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
