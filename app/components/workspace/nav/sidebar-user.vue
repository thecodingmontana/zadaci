<script setup lang="ts">
import { ChevronsUpDown, LogOut, Settings } from "@lucide/vue";
import { computed } from "vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "~/components/ui/sidebar";

const { state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");

const user = { name: "Jane Doe", email: "janedoe@gmail.com", avatar: "" };
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent">
        <Avatar class="size-8 rounded-lg">
          <AvatarImage :src="user.avatar" :alt="user.name" />
          <AvatarFallback class="rounded-lg">JD</AvatarFallback>
        </Avatar>
        <div v-if="!isCollapsed" class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-medium">{{ user.name }}</span>
          <span class="truncate text-xs text-sidebar-foreground/60">{{ user.email }}</span>
        </div>
        <ChevronsUpDown v-if="!isCollapsed" class="ml-auto size-4 opacity-60" />
      </SidebarMenuButton>
    </DropdownMenuTrigger>

    <DropdownMenuContent side="right" align="end" class="w-56">
      <DropdownMenuItem>
        <Settings class="size-4" />
        Account settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <LogOut class="size-4" />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
