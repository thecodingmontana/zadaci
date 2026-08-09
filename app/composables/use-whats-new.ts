import { useQuery } from "@tanstack/vue-query";
import { getLatestChangelogRelease } from "~~/changelog/entries";

export function useWhatsNew() {
  const { loggedIn } = useUserSession();
  const loggedInRef = computed(() => loggedIn.value);

  const { data: lastSeen, refetch } = useQuery({
    queryKey: ["whats-new-last-seen"],
    queryFn: () => $fetch<{ lastSeenVersion: string | null }>("/api/user/whats-new"),
    enabled: loggedInRef,
  });

  const latest = getLatestChangelogRelease();
  const hasUnseen = computed(() => {
    if (!latest) return false;
    if (!lastSeen.value?.lastSeenVersion) return true;
    return compareVersions(latest.version, lastSeen.value.lastSeenVersion) > 0;
  });

  async function markAsSeen() {
    if (!latest) return;
    await $fetch("/api/user/whats-new", {
      method: "PATCH",
      body: { version: latest.version },
    });
    await refetch();
  }

  return {
    latest,
    lastSeen,
    hasUnseen,
    markAsSeen,
  };
}

export function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((n) => parseInt(n, 10) || 0);
  const bParts = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
