const CLEARED_KEY = "zadaci_db_cleared_for_user";

async function clearRxDb() {
  const db = useRxDb();
  if (!db) return;

  const collections = Object.values(db.collections);
  await Promise.all(collections.map((col) => col.find().remove()));
}

/**
 * Call this BEFORE starting syncs on workspace mount.
 * Clears stale RxDB data if the user has changed since last visit.
 */
export async function useClearStaleDataOnUserSwitch(userId: string | undefined) {
  if (!userId || import.meta.server) return;

  const lastUserId = localStorage.getItem(CLEARED_KEY);
  if (lastUserId === userId) return;

  await clearRxDb();
  localStorage.setItem(CLEARED_KEY, userId);
}
