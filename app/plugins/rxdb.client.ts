import type { RxCollection, RxDatabase } from "rxdb";
import { addRxPlugin, createRxDatabase } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";

export interface TaskDocType {
  id: string;
  name: string;
  description: string | null;
  status: "idea" | "todo" | "in_progress" | "in_review" | "completed" | "abandoned";
  priority: "low" | "medium" | "high" | "none" | "urgent";
  project_id: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectDocType {
  id: string;
  title: string;
  description: string | null;
  status: "idea" | "todo" | "in_progress" | "in_review" | "completed" | "abandoned";
  priority: "low" | "medium" | "high" | "none" | "urgent";
  workspace_id: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type TaskCollection = RxCollection<TaskDocType>;
export type ProjectCollection = RxCollection<ProjectDocType>;
export type ZadaciDatabase = RxDatabase<{
  tasks: TaskCollection;
  projects: ProjectCollection;
}>;

const TASK_SCHEMA = {
  title: "tasks",
  version: 1,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    name: { type: "string", maxLength: 255 },
    description: { type: "string" },
    status: {
      type: "string",
      maxLength: 20,
      enum: ["idea", "todo", "in_progress", "in_review", "completed", "abandoned"],
    },
    priority: {
      type: "string",
      maxLength: 10,
      enum: ["low", "medium", "high", "none", "urgent"],
    },
    project_id: { type: "string", maxLength: 16 },
    due_date: { type: ["string", "null"], maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "name", "status", "priority", "project_id", "created_at", "updated_at"],
  indexes: ["project_id", "status", "updated_at"],
} as const;

const PROJECT_SCHEMA = {
  title: "projects",
  version: 1,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    title: { type: "string", maxLength: 255 },
    description: { type: "string" },
    status: {
      type: "string",
      maxLength: 20,
      enum: ["idea", "todo", "in_progress", "in_review", "completed", "abandoned"],
    },
    priority: {
      type: "string",
      maxLength: 10,
      enum: ["low", "medium", "high", "none", "urgent"],
    },
    workspace_id: { type: "string", maxLength: 16 },
    due_date: { type: ["string", "null"], maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "title", "status", "priority", "workspace_id", "created_at", "updated_at"],
  indexes: ["workspace_id", "status", "updated_at"],
} as const;

export default defineNuxtPlugin(async () => {
  if (import.meta.server) {
    return;
  }

  if (import.meta.dev) {
    addRxPlugin(RxDBDevModePlugin);
  }

  addRxPlugin(RxDBMigrationSchemaPlugin);

  const storage = import.meta.dev
    ? wrappedValidateAjvStorage({ storage: getRxStorageDexie() })
    : getRxStorageDexie();

  const db = await createRxDatabase<ZadaciDatabase>({
    name: "zadaci",
    storage,
    eventReduce: true,
  });

  await db.addCollections({
    tasks: {
      schema: TASK_SCHEMA,
      migrationStrategies: {
        1: (oldDoc) => oldDoc,
      },
    },
    projects: {
      schema: PROJECT_SCHEMA,
      migrationStrategies: {
        1: (oldDoc) => oldDoc,
      },
    },
  });

  return {
    provide: {
      rxdb: db,
    },
  };
});

declare module "#app" {
  interface NuxtApp {
    $rxdb: ZadaciDatabase;
  }
}
