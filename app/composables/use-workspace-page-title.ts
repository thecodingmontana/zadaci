import type { Workspace } from "~/types";

export function useWorkspacePageTitle(
  pageName: string,
  entityName?: Ref<string | null | undefined> | ComputedRef<string | null | undefined>,
) {
  const route = useRoute();
  const workspaceId = route.params.workspaceId as string | undefined;
  const store = useWorkspaceStore();
  const { data: workspaces } = useWorkspaces();

  const workspaceName = computed(() => {
    if (store.activeWorkspace?.name) return store.activeWorkspace.name;
    if (workspaceId && workspaces.value) {
      const ws = (workspaces.value as Workspace[]).find((w) => w.id === workspaceId);
      if (ws) return ws.name;
    }
    return null;
  });

  const title = computed(() => {
    const entity = entityName?.value;
    const ws = workspaceName.value;
    const parts = [pageName];
    if (entity) parts.push(entity);
    if (ws && entity !== ws) parts.push(ws);
    return parts.join(" | ");
  });

  return title;
}
