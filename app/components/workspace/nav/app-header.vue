<script setup lang="ts">
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import AppBreadcrumb from "./app-breadcrumb.vue";
import HeaderSearch from "./header-search.vue";
import NotificationsPopover from "./notifications-popover.vue";
import ThemeToggle from "./theme-toggle.vue";
</script>

<template>
  <header
    class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur"
  >
    <SidebarTrigger class="-ml-1 md:hidden" />
    <Separator orientation="vertical" class="mr-1 h-4 md:hidden" />

    <AppBreadcrumb />

    <div class="ml-auto flex items-center gap-2">
      <HeaderSearch />
      <ThemeToggle />
      <NotificationsPopover />
    </div>
  </header>
</template>
