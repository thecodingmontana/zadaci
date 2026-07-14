<script setup lang="ts">
import Toaster from "~/components/toast/toaster.vue";
import Sidebar from "~/components/workspace/navigations/sidebar.vue";
import WorkspaceHeader from "~/components/workspace/navigations/workspace-header.vue";
import WorkspaceProvider from "~/providers/workspace-provider.vue";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

useHead({
  htmlAttrs: {
    lang: "en",
  },
  bodyAttrs: {
    class: "min-h-screen bg-background font-sans antialiased",
  },
});

const workspaceStore = useWorkspaceStore();
const isOpenSidebar = computed(() => workspaceStore?.isOpenSidebar);
</script>

<template>
  <main class="dark:bg-[#1d1d1d]zz flex min-h-screen flex-col bg-[#fafafa]">
    <NuxtLoadingIndicator />
    <div class="flex flex-1">
      <Sidebar />
      <div
        class="relative flex size-full flex-1 flex-col gap-1 px-5 transition-[padding] duration-300 ease-in-out"
        :class="isOpenSidebar ? 'pl-0 md:pl-72' : 'pl-0'"
      >
        <WorkspaceHeader />
        <div class="flex-1 overflow-y-auto">
          <div class="px-2 sm:px-3">
            <slot />
          </div>
        </div>
      </div>
      <FAB />
    </div>
    <Toaster />
    <WorkspaceProvider />
  </main>
</template>
