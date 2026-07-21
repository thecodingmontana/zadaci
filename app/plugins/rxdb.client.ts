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

export interface ChannelDocType {
  id: string;
  workspace_id: string;
  name: string;
  type: "public" | "private";
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

export interface ConversationDocType {
  id: string;
  workspace_id: string;
  member_one_id: string;
  member_two_id: string;
  created_at: string;
  updated_at: string;
}

export interface DirectMessageDocType {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  edited_at: string | null;
  reactions: { emoji: string; member_ids: string[] }[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DirectMessageReceiptDocType {
  id: string;
  direct_message_id: string;
  member_id: string;
  status: "delivered" | "seen";
  created_at: string;
  updated_at: string;
}

export interface CommentDocType {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NoteDocType {
  id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type TaskCollection = RxCollection<TaskDocType>;
export type ProjectCollection = RxCollection<ProjectDocType>;
export type MessageCollection = RxCollection<MessageDocType>;
export type MessageReceiptCollection = RxCollection<MessageReceiptDocType>;
export type ConversationCollection = RxCollection<ConversationDocType>;
export type DirectMessageCollection = RxCollection<DirectMessageDocType>;
export type DirectMessageReceiptCollection = RxCollection<DirectMessageReceiptDocType>;
export type CommentCollection = RxCollection<CommentDocType>;
export type NoteCollection = RxCollection<NoteDocType>;
export type ZadaciDatabase = RxDatabase<{
  tasks: TaskCollection;
  projects: ProjectCollection;
  teams: RxCollection<TeamDocType>;
  tags: RxCollection<TagDocType>;
  channels: RxCollection<ChannelDocType>;
  channel_members: RxCollection<ChannelMemberDocType>;
  messages: MessageCollection;
  message_receipts: MessageReceiptCollection;
  conversations: ConversationCollection;
  direct_messages: DirectMessageCollection;
  direct_message_receipts: DirectMessageReceiptCollection;
  comments: CommentCollection;
  notes: NoteCollection;
}>;

const TASK_SCHEMA = {
  title: "tasks",
  version: 3,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    name: { type: "string", maxLength: 255 },
    description: { type: ["string", "null"] },
    status: {
      type: "string",
      maxLength: 20,
      enum: ["idea", "todo", "in_progress", "in_review", "completed", "abandoned"],
    },
    priority: { type: "string", maxLength: 10, enum: ["low", "medium", "high", "none", "urgent"] },
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
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    title: { type: "string", maxLength: 255 },
    description: { type: ["string", "null"] },
    status: {
      type: "string",
      maxLength: 20,
      enum: ["idea", "todo", "in_progress", "in_review", "completed", "abandoned"],
    },
    priority: { type: "string", maxLength: 10, enum: ["low", "medium", "high", "none", "urgent"] },
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
  primaryKey: { key: "id", fields: ["id"] },
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
  primaryKey: { key: "id", fields: ["id"] },
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

const CHANNEL_SCHEMA = {
  title: "channels",
  version: 1,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    name: { type: "string", maxLength: 255 },
    type: { type: "string", maxLength: 10, enum: ["public", "private"] },
    created_by: { type: "string", maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "workspace_id", "name", "type", "created_by", "created_at", "updated_at"],
  indexes: ["workspace_id", "updated_at"],
};

const CHANNEL_MEMBER_SCHEMA = {
  title: "channel_members",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
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

const MESSAGE_SCHEMA = {
  title: "messages",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
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
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    message_id: { type: "string", maxLength: 16 },
    member_id: { type: "string", maxLength: 16 },
    status: { type: "string", maxLength: 10, enum: ["delivered", "seen"] },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "message_id", "member_id", "status", "created_at", "updated_at"],
  indexes: ["message_id", "member_id"],
};

const CONVERSATION_SCHEMA = {
  title: "conversations",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    member_one_id: { type: "string", maxLength: 16 },
    member_two_id: { type: "string", maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "workspace_id", "member_one_id", "member_two_id", "created_at", "updated_at"],
  indexes: ["workspace_id", "member_one_id", "member_two_id"],
};

const DIRECT_MESSAGE_SCHEMA = {
  title: "direct_messages",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    conversation_id: { type: "string", maxLength: 16 },
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
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: [
    "id",
    "conversation_id",
    "author_id",
    "content",
    "reactions",
    "created_at",
    "updated_at",
  ],
  indexes: ["conversation_id"],
};

const DIRECT_MESSAGE_RECEIPT_SCHEMA = {
  title: "direct_message_receipts",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    direct_message_id: { type: "string", maxLength: 16 },
    member_id: { type: "string", maxLength: 16 },
    status: { type: "string", maxLength: 10, enum: ["delivered", "seen"] },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
  },
  required: ["id", "direct_message_id", "member_id", "status", "created_at", "updated_at"],
  indexes: ["direct_message_id", "member_id"],
};

const COMMENT_SCHEMA = {
  title: "comments",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    entity_type: { type: "string", maxLength: 50 },
    entity_id: { type: "string", maxLength: 16 },
    author_id: { type: "string", maxLength: 16 },
    content: { type: "string" },
    parent_id: { type: ["string", "null"], maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "entity_type", "entity_id", "author_id", "content", "created_at", "updated_at"],
  indexes: ["entity_type", "entity_id", "author_id"],
};

const NOTE_SCHEMA = {
  title: "notes",
  version: 0,
  type: "object",
  primaryKey: { key: "id", fields: ["id"] },
  properties: {
    id: { type: "string", maxLength: 16 },
    workspace_id: { type: "string", maxLength: 16 },
    title: { type: "string", maxLength: 255 },
    content: { type: ["string", "null"] },
    created_by: { type: "string", maxLength: 16 },
    created_at: { type: "string", maxLength: 24 },
    updated_at: { type: "string", maxLength: 24 },
    deleted_at: { type: ["string", "null"], maxLength: 24 },
  },
  required: ["id", "workspace_id", "title", "created_by", "created_at", "updated_at"],
  indexes: ["workspace_id"],
};

const DB_NAME = "zadaci";
const CLEAR_KEY = "zadaci_clear_needed";

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return;

  console.log("[rxdb-plugin] Starting RxDB plugin initialization");

  const clearFlag = localStorage.getItem(CLEAR_KEY);
  console.log("[rxdb-plugin] clear_needed flag:", clearFlag);
  if (clearFlag === "true") {
    console.log("[rxdb-plugin] NUCLEAR CLEAR — deleting IndexedDB database before RxDB loads");
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
  }

  addRxPlugin(RxDBMigrationSchemaPlugin);
  const storage = getRxStorageDexie();

  console.log("[rxdb-plugin] Creating RxDB database:", DB_NAME);
  const db = await createRxDatabase<ZadaciDatabase>({
    name: DB_NAME,
    storage,
    eventReduce: true,
    multiInstance: false,
  });

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
      migrationStrategies: { 1: (oldDoc) => oldDoc, 2: (oldDoc) => oldDoc },
    },
    teams: { schema: TEAM_SCHEMA, migrationStrategies: {} },
    tags: { schema: TAG_SCHEMA, migrationStrategies: {} },
    channels: {
      schema: CHANNEL_SCHEMA,
      migrationStrategies: {
        1: (oldDoc) =>
          oldDoc.type === "dm" ? null : { ...oldDoc, name: oldDoc.name ?? "", type: oldDoc.type },
      },
    },
    channel_members: { schema: CHANNEL_MEMBER_SCHEMA, migrationStrategies: {} },
    messages: { schema: MESSAGE_SCHEMA, migrationStrategies: {} },
    message_receipts: { schema: MESSAGE_RECEIPT_SCHEMA, migrationStrategies: {} },
    conversations: { schema: CONVERSATION_SCHEMA, migrationStrategies: {} },
    direct_messages: { schema: DIRECT_MESSAGE_SCHEMA, migrationStrategies: {} },
    direct_message_receipts: { schema: DIRECT_MESSAGE_RECEIPT_SCHEMA, migrationStrategies: {} },
    comments: { schema: COMMENT_SCHEMA, migrationStrategies: {} },
    notes: { schema: NOTE_SCHEMA, migrationStrategies: {} },
  });
  console.log("[rxdb-plugin] All collections added");

  for (const [name, col] of Object.entries(db.collections)) {
    const count = await col.count().exec();
    if (count > 0) console.log(`[rxdb-plugin] Collection "${name}" has ${count} document(s)`);
  }

  (window as any).clearRxDb = async function clearRxDb() {
    console.log("[clearRxDb] Cancelling replications...");
    for (const [, col] of Object.entries(db.collections)) {
      try {
        const reps = await (col as any).getReplicationStates();
        for (const rep of reps ?? []) await rep.cancel();
      } catch {
        /* best effort */
      }
    }
    console.log("[clearRxDb] Destroying database...");
    await db.destroy();
    console.log("[clearRxDb] Setting clear flag for next load...");
    localStorage.setItem(CLEAR_KEY, "true");
    console.log("[clearRxDb] Reloading page...");
    window.location.reload();
  };

  return { provide: { rxdb: markRaw(db) as ZadaciDatabase } };
});

declare module "#app" {
  interface NuxtApp {
    $rxdb: ZadaciDatabase;
  }
}
