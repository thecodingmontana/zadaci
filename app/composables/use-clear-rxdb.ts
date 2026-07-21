import type { ZadaciDatabase } from "~/plugins/rxdb.client";

const CLEAR_KEY = "zadaci_clear_needed";
const PURGE_DAYS = 30;
const PURGE_KEY = "zadaci_last_purge";
const USER_KEY = "zadaci_last_user_id";

function getDb(): ZadaciDatabase | null {
  return useRxDb() as unknown as ZadaciDatabase | null;
}

export async function useClearRxDb() {
  const db = getDb();
  if (!db) {
    console.warn("[useClearRxDb] No RxDB instance — cannot clear");
    return;
  }

  const collections = Object.values(db.collections);
  const counts: Record<string, number> = {};
  for (const col of collections) {
    counts[col.name] = await col.count().exec();
  }
  console.log("[useClearRxDb] Doc counts before clear:", JSON.stringify(counts));

  const totalBefore = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalBefore === 0) {
    console.log("[useClearRxDb] Already empty — skipping clear");
    return;
  }

  console.log(`[useClearRxDb] Removing ${totalBefore} docs from ${collections.length} collections`);
  await Promise.all(collections.map((col) => col.find().remove()));

  // Verify
  for (const col of collections) {
    const count = await col.count().exec();
    if (count > 0) {
      console.warn(
        `[useClearRxDb] ⚠️ Collection "${col.name}" still has ${count} docs after clear!`,
      );
    }
  }
  console.log("[useClearRxDb] ✅ Clear complete");
}

/**
 * Detects user switching by comparing the current session user ID
 * against the last stored ID. If they differ, clears all IndexedDB data
 * to prevent stale data from a previous user being pushed to the server.
 */
export async function useClearStaleDataOnUserSwitch() {
  if (import.meta.server) return;

  const { user } = useUserSession();
  const currentUserId = user.value?.id;
  console.log("[clear-stale] Checking — current user:", currentUserId);
  if (!currentUserId) {
    console.log("[clear-stale] No current user — skipping");
    return;
  }

  const lastUserId = localStorage.getItem(USER_KEY);
  console.log("[clear-stale] Last user from localStorage:", lastUserId);

  if (lastUserId === currentUserId) {
    console.log("[clear-stale] Same user as before — checking workspace-level staleness");
    await useClearStaleWorkspaceData();
    return;
  }

  // User ID changed (or first visit) — full clear
  console.log(
    "[clear-stale] ⚠️ User changed from",
    lastUserId,
    "to",
    currentUserId,
    "— clearing IndexedDB",
  );
  localStorage.setItem(CLEAR_KEY, "true");
  await useClearRxDb();
  localStorage.setItem(USER_KEY, currentUserId);
  console.log("[clear-stale] ✅ User key updated to", currentUserId);
}

/**
 * When the same user creates a new workspace (e.g. after a server DB reset),
 * the IndexedDB still contains documents from the old workspace_id.
 * This function clears everything if no data exists for the current workspace
 * but data exists for other workspaces.
 */
async function useClearStaleWorkspaceData() {
  const route = useRoute();
  const currentWsId = route.params.workspaceId as string | undefined;
  console.log("[clear-stale-ws] Checking workspace staleness — current WS:", currentWsId);
  if (!currentWsId) {
    console.log("[clear-stale-ws] No workspace ID in route — skipping");
    return;
  }

  const db = getDb();
  if (!db) {
    console.log("[clear-stale-ws] No RxDB instance — skipping");
    return;
  }

  const wsCols = ["channels", "tasks", "projects", "teams", "tags"] as const;

  let total = 0;
  let match = 0;
  const breakdown: Record<string, { total: number; match: number }> = {};

  for (const name of wsCols) {
    const col = db.collections[name];
    if (!col) {
      breakdown[name] = { total: -1, match: -1 };
      continue;
    }
    const docs = await col.find().exec();
    const wsMatch = docs.filter((d: any) => d.workspace_id === currentWsId).length;
    breakdown[name] = { total: docs.length, match: wsMatch };
    total += docs.length;
    match += wsMatch;
  }

  console.log("[clear-stale-ws] Collection breakdown:", JSON.stringify(breakdown));
  console.log("[clear-stale-ws] Total docs:", total, "Matching workspace:", match);

  if (total > 0 && match === 0) {
    console.log(
      "[clear-stale-ws] ⚠️ No local data matches current workspace — clearing everything",
    );
    await useClearRxDb();
  } else {
    console.log("[clear-stale-ws] Workspace data looks valid — no clear needed");
  }
}

/**
 * Purges soft-deleted documents older than PURGE_DAYS from RxDB.
 * Runs at most once per day to keep IndexedDB lean.
 */
export async function usePurgeOldData() {
  if (import.meta.server) return;

  const lastPurge = localStorage.getItem(PURGE_KEY);
  if (lastPurge && Date.now() - Number(lastPurge) < 86400000) return;

  const db = getDb();
  if (!db) return;

  const cutoff = new Date(Date.now() - PURGE_DAYS * 86400000).toISOString();
  const purgeable = ["tasks", "projects", "teams", "tags", "channels"] as const;

  for (const name of purgeable) {
    const col = db.collections[name];
    if (!col) continue;
    const docs = await col.find().exec();
    const oldDeleted = docs.filter((d: any) => d.deleted_at && d.deleted_at < cutoff);
    if (oldDeleted.length > 0) {
      await col.bulkRemove(oldDeleted.map((d: any) => d.id));
    }
  }

  localStorage.setItem(PURGE_KEY, String(Date.now()));
}
