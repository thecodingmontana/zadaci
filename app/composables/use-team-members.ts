import { useQuery } from "@tanstack/vue-query";

export interface TeamMember {
  id: string;
  teamId: string;
  memberId: string;
  role: string;
  userId: string;
  email: string;
  username: string | null;
  avatar: string | null;
}

export function teamMembersKey(workspaceId: string | undefined, teamId?: string | undefined) {
  return ["team-members", workspaceId, teamId] as const;
}

export function useTeamMembers(
  workspaceId: ComputedRef<string | undefined>,
  teamId?: ComputedRef<string | undefined>,
  opts?: { enabled?: ComputedRef<boolean> },
) {
  const requestFetch = useRequestFetch();

  return useQuery<TeamMember[], Error>({
    queryKey: computed(() => teamMembersKey(workspaceId.value, teamId?.value)),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId?.value) params.set("team_id", teamId.value);
      const qs = params.toString();
      const data = await requestFetch<TeamMember[]>(
        `/api/workspace/${workspaceId.value}/teammates/team-members${qs ? `?${qs}` : ""}`,
      );
      return (data ?? []).map((member: any) => ({
        id: member.id,
        teamId: member.teamId,
        memberId: member.memberId,
        role: member.role,
        userId: member.userId,
        email: member.email,
        username: member.username ?? null,
        avatar: member.avatar ?? null,
      }));
    },
    enabled: computed(() => {
      if (opts?.enabled && !opts.enabled.value) return false;
      return Boolean(workspaceId.value);
    }),
  });
}
