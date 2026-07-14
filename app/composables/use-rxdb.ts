import type { ZadaciDatabase } from "~/plugins/rxdb.client";

export function useRxDb(): ZadaciDatabase | null {
  if (import.meta.server) {
    return null;
  }
  try {
    const nuxtApp = useNuxtApp();
    return (nuxtApp.$rxdb as ZadaciDatabase) ?? null;
  } catch {
    return null;
  }
}

export async function useRxDbSafe(): Promise<ZadaciDatabase | null> {
  if (import.meta.server) {
    return null;
  }
  const nuxtApp = useNuxtApp();
  if (nuxtApp.$rxdb) {
    return nuxtApp.$rxdb as ZadaciDatabase;
  }
  await nextTick();
  return (useNuxtApp().$rxdb as ZadaciDatabase) ?? null;
}
