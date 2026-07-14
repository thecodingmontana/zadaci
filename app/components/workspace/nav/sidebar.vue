<script setup lang="ts">
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  Sidebar as SidebarRoot,
} from "~/components/ui/sidebar";
import SidebarNav from "./sidebar-nav.vue";
import SidebarUser from "./sidebar-user.vue";
import WorkspaceSwitcher from "./workspace-switcher.vue";
</script>

<template>
  <SidebarRoot collapsible="icon">
    <SidebarHeader
      class="h-14 flex-row items-center justify-between gap-1 border-b border-sidebar-border px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:py-2"
    >
      <WorkspaceSwitcher />
    </SidebarHeader>

    <SidebarContent>
      <SidebarNav />
    </SidebarContent>

    <SidebarFooter class="border-t border-sidebar-border">
      <SidebarUser />
    </SidebarFooter>

    <SidebarRail />
  </SidebarRoot>
</template>
