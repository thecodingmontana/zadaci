import type { Workspace } from "~/types";
import { useQuery } from "@tanstack/vue-query";

export function workspacesKey(userId: string | undefined) {
  return ["workspaces", userId] as const;
}

export function useWorkspaces() {
  const { user } = useUserSession();
  const requestFetch = useRequestFetch();

  return useQuery({
    queryKey: computed(() => workspacesKey(user.value?.id)),
    queryFn: () => requestFetch<Workspace[]>(`/api/workspace/user/${user.value?.id}/workspaces`),
    enabled: computed(() => Boolean(user.value?.id)),
  });
}
