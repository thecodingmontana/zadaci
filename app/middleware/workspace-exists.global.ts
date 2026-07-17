const validated = new Set<string>();

export default defineNuxtRouteMiddleware(async (to) => {
  const workspaceId = to.params.workspaceId as string | undefined;
  if (!workspaceId) return;
  if (validated.has(workspaceId)) return;

  const { loggedIn } = useUserSession();
  if (!loggedIn.value) return;

  try {
    const workspace = await $fetch(`/api/workspace/${workspaceId}/details/user-exists`);
    if (!workspace) {
      throw createError({ status: 404, statusText: "Workspace not found" });
    }
    validated.add(workspaceId);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 401
    )
      return;
    if (
      err &&
      typeof err === "object" &&
      "statusCode" in err &&
      (err as { statusCode: number }).statusCode === 401
    )
      return;
    throw createError({ status: 404, statusText: "Workspace not found" });
  }
});
