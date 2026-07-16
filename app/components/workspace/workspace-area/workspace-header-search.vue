<script setup lang="ts">
import type { CommandGroup, CommandRow } from "~/components/ui/command-menu/types";
import CommandMenu from "~/components/ui/command-menu/command-menu.vue";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

interface Member {
  name: string;
  avatar: string;
}

const members = reactive<Member[]>([
  { name: "Albert Flores", avatar: "https://i.pravatar.cc/150?img=12" },
  { name: "Arlene McCoy", avatar: "https://i.pravatar.cc/150?img=32" },
  { name: "Jane Cooper", avatar: "https://i.pravatar.cc/150?img=45" },
]);

const commandMenuOpen = ref(false);

const commandGroups = computed<CommandGroup[]>(() => [
  {
    title: "Navigation",
    rows: [
      {
        kind: "action",
        id: "dashboard",
        label: "Dashboard",
        description: "Overview & analytics",
        glyph: "hugeicons:dashboard-square-03",
        shortcut: "⌘D",
        receipt: "navigated to dashboard",
      },
      {
        kind: "action",
        id: "members",
        label: "Members",
        description: "Manage team members",
        glyph: "hugeicons:user-multiple-02",
        shortcut: "⌘M",
        receipt: "navigated to members",
      },
      {
        kind: "action",
        id: "calendar",
        label: "Calendar",
        description: "View schedule & deadlines",
        glyph: "hugeicons:calendar-03",
        shortcut: "⌘⇧C",
        receipt: "navigated to calendar",
      },
    ],
  },
  {
    title: "Quick actions",
    rows: [
      {
        kind: "action",
        id: "new-task",
        label: "New task",
        description: "Create a new task",
        glyph: "hugeicons:task-01",
        shortcut: "⌘T",
        receipt: "task created",
      },
      {
        kind: "action",
        id: "new-project",
        label: "New project",
        description: "Start a new project",
        glyph: "hugeicons:folder-01",
        shortcut: "⌘⇧P",
        receipt: "project created",
      },
      {
        kind: "action",
        id: "new-channel",
        label: "New channel",
        description: "Create a communication channel",
        glyph: "hugeicons:message-multiple-01",
        shortcut: "⌘⇧N",
        receipt: "channel created",
      },
    ],
  },
  {
    title: "Projects",
    rows: [
      {
        kind: "project",
        id: "orion-mobile",
        name: "Orion Mobile",
        meta: "12 tasks",
        gradient: ["#6366f1", "#8b5cf6"],
        progress: 75,
        shortcut: "⌘1",
      },
      {
        kind: "project",
        id: "atlas-dashboard",
        name: "Atlas Dashboard",
        meta: "8 tasks",
        gradient: ["#f59e0b", "#ef4444"],
        progress: 45,
        shortcut: "⌘2",
      },
      {
        kind: "project",
        id: "epsilon-web",
        name: "Epsilon Web",
        meta: "5 tasks",
        gradient: ["#10b981", "#06b6d4"],
        progress: 90,
        shortcut: "⌘3",
      },
    ],
  },
  {
    title: "Members",
    rows: members.map((m) => ({
      kind: "person",
      id: m.name,
      name: m.name,
      role: "Team member",
      avatar: m.avatar,
      presence: "online",
    })),
  },
  {
    title: "Communication",
    rows: [
      {
        kind: "action",
        id: "channel-general",
        label: "# General",
        description: "Team-wide announcements",
        glyph: "solar:hashtag-chat-linear",
        shortcut: "⌘⇧G",
        receipt: "opened general",
      },
      {
        kind: "action",
        id: "channel-design",
        label: "# Design Status",
        description: "Design updates & reviews",
        glyph: "solar:hashtag-chat-linear",
        shortcut: "⌘⇧D",
        receipt: "opened design status",
      },
      {
        kind: "action",
        id: "channel-development",
        label: "# Development",
        description: "Engineering discussion",
        glyph: "solar:hashtag-chat-linear",
        shortcut: "⌘⇧E",
        receipt: "opened development",
      },
    ],
  },
  {
    title: "Settings",
    rows: [
      {
        kind: "action",
        id: "settings-general",
        label: "General",
        description: "Workspace preferences",
        glyph: "hugeicons:settings-02",
        shortcut: "⌘,",
        receipt: "opened general settings",
      },
      {
        kind: "action",
        id: "settings-profile",
        label: "Profile",
        description: "Manage your account",
        glyph: "hugeicons:user-circle",
        shortcut: "",
        receipt: "opened profile",
      },
      {
        kind: "action",
        id: "settings-security",
        label: "Security",
        description: "Password & access control",
        glyph: "hugeicons:shield-01",
        shortcut: "",
        receipt: "opened security",
      },
    ],
  },
]);

function onCommandRun(row: CommandRow) {
  console.log("command run", row);
}
</script>

<template>
  <button
    type="button"
    class="relative flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
    @click="commandMenuOpen = true"
  >
    <Icon name="hugeicons:search-01" size="16" />
    <span class="flex-1 text-left">Search anything</span>
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  </button>

  <CommandMenu
    v-model:open="commandMenuOpen"
    :groups="commandGroups"
    hotkey="Mod+K"
    @run="onCommandRun"
  />
</template>
