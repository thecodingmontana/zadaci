import type { WorkspaceInvite } from "~/types";
import { useQuery } from "@tanstack/vue-query";

export function workspaceInvitesKey(workspaceId: string | undefined) {
  return ["workspace-invites", workspaceId] as const;
}

export function useWorkspaceInvites(
  workspaceId: ComputedRef<string | undefined>,
  opts?: { enabled?: ComputedRef<boolean> },
) {
  const requestFetch = useRequestFetch();

  return useQuery<WorkspaceInvite[], Error>({
    queryKey: computed(() => workspaceInvitesKey(workspaceId.value)),
    queryFn: async () => {
      const data = await requestFetch<any[]>(
        `/api/workspace/${workspaceId.value}/teammates/team-invite/sent`,
      );
      return (data ?? []).map((invite: any) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        workspaceId: invite.workspace_id,
        status: invite.status,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        updatedAt: invite.updated_at ?? null,
        invitedBy: invite.invited_by,
        user: {
          id: invite.user.id,
          email: invite.user.email,
          username: invite.user.username ?? null,
          profilePictureUrl: invite.user.profile_picture_url ?? null,
        },
      }));
    },
    enabled: computed(() => {
      if (opts?.enabled && !opts.enabled.value) return false;
      return Boolean(workspaceId.value);
    }),
  });
}
