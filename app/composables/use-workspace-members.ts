import type { TeammatesWithProfile } from "~/types";
import { useQuery } from "@tanstack/vue-query";

export function workspaceMembersKey(workspaceId: string | undefined) {
  return ["workspace-members", workspaceId] as const;
}

export function useWorkspaceMembers(
  workspaceId: ComputedRef<string | undefined>,
  opts?: { enabled?: ComputedRef<boolean> },
) {
  const requestFetch = useRequestFetch();

  return useQuery<TeammatesWithProfile[], Error>({
    queryKey: computed(() => workspaceMembersKey(workspaceId.value)),
    queryFn: async () => {
      console.log(`[useWorkspaceMembers] Fetching teammates for workspace`, workspaceId.value);
      const data = await requestFetch<{ members: any[] }>(
        `/api/workspace/${workspaceId.value}/teammates`,
      );
      console.log(
        `[useWorkspaceMembers] Response for workspace ${workspaceId.value}:`,
        "has members key =",
        Array.isArray(data?.members),
        "members count =",
        data?.members?.length ?? 0,
        "top keys =",
        data ? Object.keys(data).slice(0, 8) : null,
      );
      return (data?.members ?? []).map((member: any) => ({
        id: member.id,
        createdAt: member.created_at,
        updatedAt: member.updated_at,
        userId: member.user_id,
        workspaceId: member.workspace_id,
        role: member.role,
        user: {
          id: member.user.id,
          email: member.user.email,
          username: member.user.username ?? null,
          emailVerified: member.user.email_verified,
          registered2FA: member.user.registered_2fa,
          profilePictureUrl: member.user.profile_picture_url ?? null,
        },
      }));
    },
    enabled: computed(() => {
      if (opts?.enabled && !opts.enabled.value) return false;
      return Boolean(workspaceId.value);
    }),
  });
}
