import type { RxCollection, RxDatabase } from "rxdb";
import { addRxPlugin, createRxDatabase } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { markRaw } from "vue";

export interface TaskDocType {
  id: string;
  name: string;
  description: string | null;
  status: "idea" | "todo" | "in_progress" | "in_review" | "completed" | "abandoned";
  priority: "low" | "medium" | "high" | "none" | "urgent";
  project_id: string;
  parent_task_id: string | null;
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

export interface TeamDocType {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TagDocType {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectTagDocType {
  id: string;
  project_id: string;
  tag_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskTagDocType {
  id: string;
  task_id: string;
  tag_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAssigneeDocType {
  id: string;
  task_id: string;
  member_id: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChannelDocType {
  id: string;
  workspace_id: string;
  name: string | null;
  type: "public" | "private" | "dm";
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChannelMemberDocType {
  id: string;
  channel_id: string;
  member_id: string;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberDocType {
  id: string;
  role: "owner" | "moderator" | "member";
  user_id: string;
  workspace_id: string;
  username: string;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskActivityDocType {
  id: string;
  status: "idea" | "todo" | "in_progress" | "in_review" | "completed" | "abandoned";
  task_id: string;
  changed_by: string;
  changed_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageDocType {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  edited_at: string | null;
  reactions: { emoji: string; member_ids: string[] }[];
  parent_message_id: string | null;
  thread_reply_count: number;
  thread_participant_ids: string[];
  thread_last_reply_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MessageReceiptDocType {
  id: string;
  message_id: string;
  member_id: string;
  status: "delivered" | "seen";
  created_at: string;
  updated_at: string;
}

export interface UserStatusDocType {
  id: string;
  user_id: string;
  status: "available" | "busy" | "away" | "dnd" | "offline";
  custom_message: string | null;
  status_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskCollection = RxCollection<TaskDocType>;
export type ProjectCollection = RxCollection<ProjectDocType>;
export type MessageCollection = RxCollection<MessageDocType>;
export type MessageReceiptCollection = RxCollection<MessageReceiptDocType>;
export type ZadaciDatabase = RxDatabase<{
  tasks: TaskCollection;
  projects: ProjectCollection;
  teams: RxCollection<TeamDocType>;
  tags: RxCollection<TagDocType>;
  project_tags: RxCollection<ProjectTagDocType>;
  task_tags: RxCollection<TaskTagDocType>;
  task_assignees: RxCollection<TaskAssigneeDocType>;
  channels: RxCollection<ChannelDocType>;
  channel_members: RxCollection<ChannelMemberDocType>;
  workspace_members: RxCollection<WorkspaceMemberDocType>;
  user_status: RxCollection<UserStatusDocType>;
  tasks_activity: RxCollection<TaskActivityDocType>;
  messages: MessageCollection;
  message_receipts: MessageReceiptCollection;
}>;

const TASK_SCHEMA = {
  title: "tasks",
  version: 3,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    name: { type: "string", maxLength: 255 },
    description: { type: ["string", "null"] },
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
    parent_task_id: { type: ["string", "null"], maxLength: 16 },
    due_date: { type: ["string", "null"], maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "name", "status", "priority", "project_id", "created_at", "updated_at"],
  indexes: ["project_id", "status", "updated_at"],
};

const PROJECT_SCHEMA = {
  title: "projects",
  version: 2,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    title: { type: "string", maxLength: 255 },
    description: { type: ["string", "null"] },
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
};

const TEAM_SCHEMA = {
  title: "teams",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    name: { type: "string", maxLength: 255 },
    color: { type: ["string", "null"] },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "workspace_id", "name", "created_at", "updated_at"],
  indexes: ["workspace_id", "updated_at"],
};

const TAG_SCHEMA = {
  title: "tags",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    name: { type: "string", maxLength: 100 },
    color: { type: ["string", "null"] },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "workspace_id", "name", "created_at", "updated_at"],
  indexes: ["workspace_id", "updated_at"],
};

const PROJECT_TAG_SCHEMA = {
  title: "project_tags",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    project_id: { type: "string", maxLength: 16 },
    tag_id: { type: "string", maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "project_id", "tag_id", "created_at", "updated_at"],
  indexes: ["project_id", "tag_id"],
};

const TASK_TAG_SCHEMA = {
  title: "task_tags",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    task_id: { type: "string", maxLength: 16 },
    tag_id: { type: "string", maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "task_id", "tag_id", "created_at", "updated_at"],
  indexes: ["task_id", "tag_id"],
};

const CHANNEL_SCHEMA = {
  title: "channels",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    name: { type: ["string", "null"] },
    type: {
      type: "string",
      maxLength: 10,
      enum: ["public", "private", "dm"],
    },
    created_by: { type: "string", maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "workspace_id", "type", "created_by", "created_at", "updated_at"],
  indexes: ["workspace_id", "updated_at"],
};

const CHANNEL_MEMBER_SCHEMA = {
  title: "channel_members",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    channel_id: { type: "string", maxLength: 16 },
    member_id: { type: "string", maxLength: 16 },
    last_read_at: { type: ["string", "null"], maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "channel_id", "member_id", "created_at", "updated_at"],
  indexes: ["channel_id", "member_id"],
};

const WORKSPACE_MEMBER_SCHEMA = {
  title: "workspace_members",
  version: 1,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    role: {
      type: "string",
      maxLength: 10,
      enum: ["owner", "moderator", "member"],
    },
    user_id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    username: { type: "string", maxLength: 255 },
    profile_picture_url: { type: ["string", "null"] },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "role", "user_id", "workspace_id", "username", "created_at", "updated_at"],
  indexes: ["workspace_id", "user_id", "updated_at"],
};

const TASK_ACTIVITY_SCHEMA = {
  title: "tasks_activity",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    status: {
      type: "string",
      maxLength: 20,
      enum: ["idea", "todo", "in_progress", "in_review", "completed", "abandoned"],
    },
    task_id: { type: "string", maxLength: 16 },
    changed_by: { type: "string", maxLength: 16 },
    changed_at: { type: "string", maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "status", "task_id", "changed_by", "changed_at", "created_at", "updated_at"],
  indexes: ["task_id", "changed_by", "updated_at"],
};

const TASK_ASSIGNEE_SCHEMA = {
  title: "task_assignees",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    task_id: { type: "string", maxLength: 16 },
    member_id: { type: "string", maxLength: 16 },
    assigned_at: { type: "string", maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "task_id", "member_id", "assigned_at", "created_at", "updated_at"],
  indexes: ["task_id", "member_id", "updated_at"],
};

const MESSAGE_SCHEMA = {
  title: "messages",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    channel_id: { type: "string", maxLength: 16 },
    author_id: { type: "string", maxLength: 16 },
    content: { type: "string" },
    edited_at: { type: ["string", "null"], maxLength: 24 },
    reactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          emoji: { type: "string" },
          member_ids: {
            type: "array",
            items: { type: "string", maxLength: 16 },
            uniqueItems: true,
          },
        },
        required: ["emoji", "member_ids"],
      },
    },
    parent_message_id: { type: ["string", "null"], maxLength: 16 },
    thread_reply_count: { type: "number" },
    thread_participant_ids: {
      type: "array",
      items: { type: "string", maxLength: 16 },
      uniqueItems: true,
    },
    thread_last_reply_at: { type: ["string", "null"], maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: [
    "id",
    "channel_id",
    "author_id",
    "content",
    "reactions",
    "thread_reply_count",
    "thread_participant_ids",
    "created_at",
    "updated_at",
  ],
  indexes: ["channel_id"],
};

const MESSAGE_RECEIPT_SCHEMA = {
  title: "message_receipts",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    message_id: { type: "string", maxLength: 16 },
    member_id: { type: "string", maxLength: 16 },
    status: {
      type: "string",
      maxLength: 10,
      enum: ["delivered", "seen"],
    },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "message_id", "member_id", "status", "created_at", "updated_at"],
  indexes: ["message_id", "member_id"],
};

const USER_STATUS_SCHEMA = {
  title: "user_status",
  version: 0,
  type: "object",
  primaryKey: {
    key: "id",
    fields: ["id"],
  },
  properties: {
    id: { type: "string", maxLength: 16 },
    user_id: { type: "string", maxLength: 16 },
    status: {
      type: "string",
      maxLength: 10,
      enum: ["available", "busy", "away", "dnd", "offline"],
    },
    custom_message: { type: ["string", "null"] },
    status_expires_at: { type: ["string", "null"], maxLength: 24 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "user_id", "status", "created_at", "updated_at"],
  indexes: ["user_id", "updated_at"],
};

const DB_NAME = "zadaci";
const CLEAR_KEY = "zadaci_clear_needed";

export default defineNuxtPlugin(async () => {
  if (import.meta.server) {
    return;
  }

  console.log("[rxdb-plugin] Starting RxDB plugin initialization");

  // Nuclear clear: if a previous session left stale data in IndexedDB,
  // delete the entire database before RxDB loads it. This prevents old
  // documents from being pushed to the wrong workspace (403 errors).
  const clearFlag = localStorage.getItem(CLEAR_KEY);
  console.log("[rxdb-plugin] clear_needed flag:", clearFlag);
  if (clearFlag === "true") {
    console.log("[rxdb-plugin] ⚠️ NUCLEAR CLEAR — deleting IndexedDB database before RxDB loads");
    localStorage.removeItem(CLEAR_KEY);
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => {
        console.log("[rxdb-plugin] IndexedDB deleted successfully");
        resolve();
      };
      req.onerror = () => {
        console.log("[rxdb-plugin] IndexedDB delete error (best effort):", req.error);
        resolve();
      };
      req.onblocked = () => {
        console.log("[rxdb-plugin] IndexedDB delete blocked (another tab open)");
        resolve();
      };
    });
  } else {
    console.log("[rxdb-plugin] No clear needed, proceeding with existing IndexedDB");
  }

  addRxPlugin(RxDBMigrationSchemaPlugin);

  const storage = getRxStorageDexie();

  console.log("[rxdb-plugin] Creating RxDB database:", DB_NAME);
  const db = await createRxDatabase<ZadaciDatabase>({
    name: DB_NAME,
    storage,
    eventReduce: true,
  });
  console.log("[rxdb-plugin] Database created");

  console.log("[rxdb-plugin] Adding collections...");
  await db.addCollections({
    tasks: {
      schema: TASK_SCHEMA,
      migrationStrategies: {
        1: (oldDoc) => ({ ...oldDoc, parent_task_id: null }),
        2: (oldDoc) => ({ ...oldDoc, parent_task_id: null }),
        3: (oldDoc) => oldDoc,
      },
    },
    projects: {
      schema: PROJECT_SCHEMA,
      migrationStrategies: {
        1: (oldDoc) => oldDoc,
        2: (oldDoc) => oldDoc,
      },
    },
    teams: { schema: TEAM_SCHEMA, migrationStrategies: {} },
    tags: { schema: TAG_SCHEMA, migrationStrategies: {} },
    project_tags: { schema: PROJECT_TAG_SCHEMA, migrationStrategies: {} },
    task_tags: { schema: TASK_TAG_SCHEMA, migrationStrategies: {} },
    task_assignees: { schema: TASK_ASSIGNEE_SCHEMA, migrationStrategies: {} },
    channels: { schema: CHANNEL_SCHEMA, migrationStrategies: {} },
    channel_members: { schema: CHANNEL_MEMBER_SCHEMA, migrationStrategies: {} },
    workspace_members: {
      schema: WORKSPACE_MEMBER_SCHEMA,
      migrationStrategies: {
        1: (oldDoc) => {
          const role = oldDoc.role === "guest" ? "member" : oldDoc.role;
          return { ...oldDoc, role };
        },
      },
    },
    user_status: { schema: USER_STATUS_SCHEMA, migrationStrategies: {} },
    tasks_activity: { schema: TASK_ACTIVITY_SCHEMA, migrationStrategies: {} },
    messages: { schema: MESSAGE_SCHEMA, migrationStrategies: {} },
    message_receipts: { schema: MESSAGE_RECEIPT_SCHEMA, migrationStrategies: {} },
  });
  console.log("[rxdb-plugin] All collections added");

  // Log initial document counts per collection
  for (const [name, col] of Object.entries(db.collections)) {
    const count = await col.count().exec();
    if (count > 0) {
      console.log(`[rxdb-plugin] Collection "${name}" has ${count} document(s)`);
    }
  }

  // Expose clear function globally for debugging/fresh-start scenarios
  (window as any).clearRxDb = async function clearRxDb() {
    console.log("[clearRxDb] Cancelling replications...");
    for (const [, col] of Object.entries(db.collections)) {
      try {
        const reps = await (col as any).getReplicationStates();
        for (const rep of reps ?? []) {
          await rep.cancel();
        }
      } catch {
        // best effort
      }
    }
    console.log("[clearRxDb] Destroying database...");
    await db.destroy();
    console.log("[clearRxDb] Setting clear flag for next load...");
    localStorage.setItem(CLEAR_KEY, "true");
    console.log("[clearRxDb] Reloading page...");
    window.location.reload();
  };

  return {
    provide: {
      rxdb: markRaw(db) as ZadaciDatabase,
    },
  };
});

declare module "#app" {
  interface NuxtApp {
    $rxdb: ZadaciDatabase;
  }
}
