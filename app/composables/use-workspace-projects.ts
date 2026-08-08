import type { ProjectDocType } from "~/plugins/rxdb.client";

export function useWorkspaceProjects(workspaceId: () => string | undefined) {
  const projects = ref<ProjectDocType[]>([]);
  let sub: { unsubscribe: () => void } | null = null;

  async function subscribe() {
    const db = await useRxDbSafe();
    sub?.unsubscribe();
    if (!db) return;
    const wsId = workspaceId();
    if (!wsId) {
      projects.value = [];
      return;
    }
    sub = db.projects
      .find({
        selector: { workspace_id: wsId, deleted_at: null },
      })
      .$.subscribe((docs) => {
        projects.value = docs;
      });
  }

  watch(workspaceId, subscribe, { immediate: true });

  onUnmounted(() => {
    sub?.unsubscribe();
  });

  const activeProjects = computed(() => projects.value.filter((p) => !p.deleted_at));

  return { projects, activeProjects };
}
