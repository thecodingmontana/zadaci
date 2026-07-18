import type { Workspace } from "~/types";

export type Role = "owner" | "moderator" | "member";

export interface Permission {
  canManageMembers: boolean;
  canManageTeams: boolean;
  canManageChannels: boolean;
  canManageSettings: boolean;
  canDeleteWorkspace: boolean;
  canInvite: boolean;
}

export function usePermissions(workspace: ComputedRef<Workspace | null>) {
  const role = computed<Role>(() => workspace.value?.userRole ?? "member");

  const isOwnerOrModerator = computed(() => role.value === "owner" || role.value === "moderator");

  const permissions = computed<Permission>(() => ({
    canManageMembers: isOwnerOrModerator.value,
    canManageTeams: isOwnerOrModerator.value,
    canManageChannels: isOwnerOrModerator.value,
    canManageSettings: isOwnerOrModerator.value,
    canDeleteWorkspace: role.value === "owner",
    canInvite: isOwnerOrModerator.value,
  }));

  return { role, permissions, isOwnerOrModerator };
}
