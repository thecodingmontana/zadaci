import type { ZadaciDatabase } from "~/plugins/rxdb.client";

const PURGE_DAYS = 30;
const PURGE_KEY = "zadaci_last_purge";

function getDb(): ZadaciDatabase | null {
  return useRxDb() as unknown as ZadaciDatabase | null;
}

export async function useClearRxDb() {
  const db = getDb();
  if (!db) return;

  const collections = Object.values(db.collections);
  await Promise.all(collections.map((col) => col.find().remove()));
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
