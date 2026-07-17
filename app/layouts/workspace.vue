<script setup lang="ts">
import { useNetwork } from "@vueuse/core";
import Toaster from "~/components/toast/toaster.vue";
import NavigationSidebar from "~/components/workspace/navigations/navigation-sidebar.vue";
import WorkspaceWrapper from "~/components/workspace/navigations/workspace-wrapper.vue";

const network = reactive(useNetwork());
const wasDismissed = ref(false);
const isOffline = computed(() => !network.isOnline && !wasDismissed.value);

const route = useRoute();
const { loggedIn, user } = useUserSession();
const workspaceId = computed(() => route.params.workspaceId as string | undefined);
const wsId = () => workspaceId.value;

const USER_KEY = "zadaci_last_user_id";
const CLEAR_KEY = "zadaci_clear_needed";

console.log("[workspace-layout] Mounted — loggedIn:", loggedIn.value, "workspaceId:", wsId());

// ── Session expiry guard ──
watch(loggedIn, (val) => {
  console.log("[workspace-layout] loggedIn changed to:", val);
  if (!val) {
    console.log("[workspace-layout] Session expired — triggering RxDB clear");
    useClearRxDb();
  }
});

// ── User-change detection (sets nuclear clear flag) ──
if (import.meta.client) {
  watchEffect(() => {
    if (loggedIn.value && user.value?.id) {
      const currentUserId = user.value.id;
      const lastUserId = localStorage.getItem(USER_KEY);
      console.log("[workspace-layout] watchEffect — user:", currentUserId, "last:", lastUserId);
      if (lastUserId && lastUserId !== currentUserId) {
        console.log("[workspace-layout] User changed — setting clear_needed flag");
        localStorage.setItem(CLEAR_KEY, "true");
      }
      localStorage.setItem(USER_KEY, currentUserId);
    }
  });
}

// ── RxDB sync composables ──
const taskSync = useTaskSync(wsId);
const projectSync = useProjectSync(wsId);
const teamSync = useTeamSync(wsId);
const tagSync = useTagSync(wsId);
const projectTagSync = useProjectTagSync(wsId);
const taskTagSync = useTaskTagSync(wsId);
const channelSync = useChannelSync(wsId);
const channelMemberSync = useChannelMemberSync(wsId);
const workspaceMemberSync = useWorkspaceMemberSync(wsId);
const userStatusSync = useUserStatusSync(wsId);

onMounted(async () => {
  console.log("[workspace-layout] onMounted — running stale-data check + starting syncs");

  usePurgeOldData();
  console.log("[workspace-layout] Calling useClearStaleDataOnUserSwitch...");
  await useClearStaleDataOnUserSwitch();
  console.log("[workspace-layout] Stale check done — starting syncs");

  const syncs: [string, Promise<void>][] = [
    ["taskSync", taskSync.start()],
    ["projectSync", projectSync.start()],
    ["teamSync", teamSync.start()],
    ["tagSync", tagSync.start()],
    ["projectTagSync", projectTagSync.start()],
    ["taskTagSync", taskTagSync.start()],
    ["channelSync", channelSync.start()],
    ["channelMemberSync", channelMemberSync.start()],
    ["workspaceMemberSync", workspaceMemberSync.start()],
    ["userStatusSync", userStatusSync.start()],
  ];

  await Promise.all(
    syncs.map(async ([name, promise]) => {
      try {
        await promise;
        console.log(`[workspace-layout] Sync started: ${name}`);
      } catch (err) {
        console.error(`[workspace-layout] Sync FAILED: ${name}`, err);
      }
    }),
  );
  console.log("[workspace-layout] All syncs started");
});

useHead({
  htmlAttrs: {
    lang: "en",
  },
  bodyAttrs: {
    class: "min-h-screen bg-background font-sans antialiased",
  },
});
</script>

<template>
  <div class="h-full">
    <NuxtLoadingIndicator />

    <div
      v-if="isOffline"
      class="relative z-50 flex items-center justify-center gap-2 bg-[#fafafa] px-4 py-2 text-center text-xs font-medium text-black/70 dark:border-white/10 dark:bg-[#111110] dark:text-white/70"
    >
      <Icon name="hugeicons:wifi-off-01" class="shrink-0 text-amber-500" size="16" />
      <span> You're offline — changes will sync automatically when connection returns. </span>
      <button
        type="button"
        aria-label="Dismiss banner"
        class="ml-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
        @click="wasDismissed = true"
      >
        <Icon name="hugeicons:cancel-01" class="size-3.5" />
      </button>
    </div>

    <div class="fixed inset-y-0 z-30 hidden h-full w-18 flex-col md:flex">
      <NavigationSidebar />
    </div>

    <main class="h-full md:pl-20">
      <div class="fixed inset-y-0 z-20 hidden h-full w-64 flex-col md:flex">
        <WorkspaceWrapper />
      </div>
      <div class="h-full md:pl-64">
        <slot />
      </div>
    </main>
    <Toaster />
  </div>
</template>
