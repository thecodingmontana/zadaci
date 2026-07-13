import { useQuery, useQueryClient } from "@tanstack/vue-query";

export interface SidebarProject {
  id: string;
  title: string;
  dueDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function sidebarProjectsKey(workspaceId: string | undefined) {
  return ["sidebar-projects", workspaceId] as const;
}

export function useSidebarProjects(workspaceId: ComputedRef<string | undefined>) {
  const requestFetch = useRequestFetch();

  return useQuery({
    queryKey: computed(() => sidebarProjectsKey(workspaceId.value)),
    queryFn: async () => {
      const data = await requestFetch<any[]>(
        `/api/workspace/${workspaceId.value}/user/projects/all`,
      );
      return data.map((project) => ({
        ...project,
        dueDate: project.dueDate ? new Date(project.dueDate) : null,
        createdAt: project.createdAt ? new Date(project.createdAt) : null,
        updatedAt: project.updatedAt ? new Date(project.updatedAt) : null,
      })) as SidebarProject[];
    },
    enabled: computed(() => Boolean(workspaceId.value)),
  });
}

export function useInvalidateSidebarProjects() {
  const queryClient = useQueryClient();
  return (workspaceId: string) =>
    queryClient.invalidateQueries({ queryKey: sidebarProjectsKey(workspaceId) });
}
