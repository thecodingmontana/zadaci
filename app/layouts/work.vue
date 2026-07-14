<script setup lang="ts">
import Toaster from "~/components/toast/toaster.vue";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import AppHeader from "~/components/workspace/nav/app-header.vue";
import AppSidebar from "~/components/workspace/nav/sidebar.vue";
</script>

<template>
  <main class="flex min-h-screen flex-col">
    <NuxtLoadingIndicator />

    <SidebarProvider class="flex flex-1">
      <AppSidebar />

      <SidebarInset>
        <AppHeader />
        <div class="flex flex-1 flex-col">
          <slot />
        </div>
      </SidebarInset>
    </SidebarProvider>

    <Toaster />
  </main>
</template>
