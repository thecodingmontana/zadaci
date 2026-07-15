<script setup lang="ts">
import Toaster from "~/components/toast/toaster.vue";
import NavigationSidebar from "~/components/workspace/nav/navigation-sidebar.vue";
</script>

<template>
  <div class="h-full">
    <NuxtLoadingIndicator />

    <div class="hidden md:flex h-full w-18 z-30 flex-col fixed inset-y-0">
                    <NavigationSidebar />
                </div>

                <main class="md:pl-18 h-full">
                    <slot />
                </main>

    <Toaster />
  </div>
</template>
