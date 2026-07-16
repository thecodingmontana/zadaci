<script setup lang="ts">
import Toaster from "~/components/toast/toaster.vue";
import NavigationSidebar from "~/components/workspace/navigations/navigation-sidebar.vue";
import WorkspaceWrapper from "~/components/workspace/navigations/workspace-wrapper.vue";

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
    <!-- <HotkeysDevtoolsPanel /> -->
  </div>
</template>
