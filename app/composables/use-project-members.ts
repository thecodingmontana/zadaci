import { useQuery } from "@tanstack/vue-query";

export interface ProjectMember {
  email: string;
  avatar: string | null;
  username: string;
  member_id: string;
}

export function projectMembersKey(projectId: string | undefined) {
  return ["project-members", projectId] as const;
}

export function useProjectMembers(
  workspaceId: ComputedRef<string | undefined>,
  projectId: ComputedRef<string | undefined>,
  opts?: { enabled?: ComputedRef<boolean> },
) {
  const requestFetch = useRequestFetch();

  return useQuery<ProjectMember[], Error>({
    queryKey: computed(() => projectMembersKey(projectId.value)),
    queryFn: async () => {
      const data = await requestFetch<ProjectMember[]>(
        `/api/workspace/${workspaceId.value}/project/${projectId.value}/teammates`,
      );
      return (data ?? []).map((member: any) => ({
        email: member.email,
        avatar: member.avatar ?? null,
        username: member.username,
        member_id: member.member_id,
      }));
    },
    enabled: computed(() => {
      if (opts?.enabled && !opts.enabled.value) return false;
      return Boolean(workspaceId.value) && Boolean(projectId.value);
    }),
  });
}
