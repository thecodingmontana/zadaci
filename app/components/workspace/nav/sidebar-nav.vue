<script setup lang="ts">
import { Calendar, Inbox, LayoutDashboard, Library, Settings, Users } from "@lucide/vue";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

const core = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", to: "/calendar", icon: Calendar },
  { label: "Library", to: "/library", icon: Library },
  { label: "Inbox", to: "/inbox", icon: Inbox, count: 7 },
];

const team = [
  { label: "Team & Permissions", to: "/team", icon: Users },
  { label: "Settings", to: "/settings", icon: Settings },
];
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel>Core</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in core" :key="item.label">
          <SidebarMenuButton as-child :tooltip="item.label">
            <NuxtLink :to="item.to">
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </SidebarMenuButton>
          <SidebarMenuBadge v-if="item.count">{{ item.count }}</SidebarMenuBadge>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  <SidebarGroup>
    <SidebarGroupLabel>System</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in team" :key="item.label">
          <SidebarMenuButton as-child :tooltip="item.label">
            <NuxtLink :to="item.to">
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
