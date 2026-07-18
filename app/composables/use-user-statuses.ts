import { useQuery } from "@tanstack/vue-query";

export interface UserStatus {
  id: string;
  userId: string;
  status: string;
  customMessage: string | null;
  statusExpiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export function userStatusesKey(workspaceId: string | undefined) {
  return ["user-statuses", workspaceId] as const;
}

export function useUserStatuses(
  workspaceId: ComputedRef<string | undefined>,
  opts?: { enabled?: ComputedRef<boolean> },
) {
  const requestFetch = useRequestFetch();

  return useQuery<UserStatus[], Error>({
    queryKey: computed(() => userStatusesKey(workspaceId.value)),
    queryFn: async () => {
      const data = await requestFetch<any[]>(`/api/workspace/${workspaceId.value}/user-statuses`);
      return (data ?? []).map((status: any) => ({
        id: status.id,
        userId: status.user_id,
        status: status.status,
        customMessage: status.custom_message ?? null,
        statusExpiresAt: status.status_expires_at ?? null,
        createdAt: status.created_at,
        updatedAt: status.updated_at ?? null,
      }));
    },
    enabled: computed(() => {
      if (opts?.enabled && !opts.enabled.value) return false;
      return Boolean(workspaceId.value);
    }),
  });
}
