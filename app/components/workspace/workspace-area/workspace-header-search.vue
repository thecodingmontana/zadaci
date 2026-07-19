<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { CommandGroup, CommandPresence, CommandRow } from "~/components/ui/command-menu/types";
import type {
  ChannelDocType,
  ProjectDocType,
  TaskDocType,
  TeamDocType,
} from "~/plugins/rxdb.client";
import { useHotkey } from "@tanstack/vue-hotkeys";
import CommandMenu from "~/components/ui/command-menu/command-menu.vue";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const db = useRxDb();

const projects = ref<ProjectDocType[]>([]);
const teams = ref<TeamDocType[]>([]);
const channels = ref<ChannelDocType[]>([]);
const tasks = ref<TaskDocType[]>([]);

const { data: members } = useWorkspaceMembers(workspaceId);
const presence = useWorkspacePresence(() => workspaceId.value);

const subscriptions: (() => void)[] = [];

function subscribe<T>(
  collection: RxCollection<T> | undefined,
  selector: any,
  target: { value: T[] },
): () => void {
  if (!collection) return () => {};
  const sub = collection.find({ selector }).$.subscribe((docs) => {
    target.value = docs;
  });
  return () => sub.unsubscribe();
}

watch(
  [() => db, workspaceId],
  ([database, wsId]) => {
    subscriptions.forEach((fn) => fn());
    subscriptions.length = 0;
    if (!database || !wsId) return;
    subscriptions.push(
      subscribe(database.projects as any, { workspace_id: wsId, deleted_at: null }, projects),
      subscribe(database.teams as any, { workspace_id: wsId, deleted_at: null }, teams),
      subscribe(database.channels as any, { workspace_id: wsId, deleted_at: null }, channels),
      subscribe(database.tasks as any, {}, tasks),
    );
  },
  { immediate: true },
);

onMounted(() => {
  presence.start();
});

onUnmounted(() => {
  subscriptions.forEach((fn) => fn());
});

const commandMenuOpen = ref(false);

const memberPresence = computed(() => {
  const online = presence.onlineUserIds.value;
  const map = new Map<string, CommandPresence>();
  for (const m of members.value ?? []) {
    map.set(m.userId, online.has(m.userId) ? "online" : "away");
  }
  return map;
});

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
    rows: projects.value
      .filter((p) => !p.deleted_at)
      .map((p, i) => ({
        kind: "project" as const,
        id: p.id,
        name: p.title,
        meta: `${tasks.value.filter((t) => t.project_id === p.id && !t.deleted_at).length} tasks`,
        gradient: [
          ["#6366f1", "#8b5cf6"],
          ["#f59e0b", "#ef4444"],
          ["#10b981", "#06b6d4"],
        ][i % 3] as [string, string],
        progress: 0.5,
        shortcut: `⌘${i + 1}`,
      })),
  },
  {
    title: "Members",
    rows: (members.value ?? []).map((m) => ({
      kind: "person" as const,
      id: m.id,
      name: m.user.username ?? m.user.email,
      role: m.role === "owner" ? "Owner" : m.role === "moderator" ? "Moderator" : "Member",
      avatar: m.user.profilePictureUrl ?? undefined,
      presence: memberPresence.value.get(m.userId) ?? "away",
    })),
  },
  {
    title: "Communication",
    rows: channels.value
      .filter((c) => c.type !== "dm")
      .map((c) => ({
        kind: "action" as const,
        id: c.id,
        label: `# ${c.name}`,
        description: c.type === "private" ? "Private channel" : "Public channel",
        glyph: "solar:hashtag-chat-linear",
        shortcut: "",
        receipt: `opened ${c.name}`,
      })),
  },
  {
    title: "Teams",
    rows: teams.value.map((t) => ({
      kind: "action" as const,
      id: t.id,
      label: t.name,
      description: "Team",
      glyph: "hugeicons:user-group",
      shortcut: "",
      receipt: `opened ${t.name}`,
    })),
  },
]);

function onCommandRun(row: CommandRow) {
  const wsId = workspaceId.value;
  if (!wsId) return;
  if (row.kind === "person") {
    navigateTo(`/workspace/${wsId}/conversations/${row.id}`);
    return;
  }
  switch (row.id) {
    case "dashboard":
      navigateTo(`/workspace/${wsId}/dashboard`);
      break;
    case "members":
      navigateTo(`/workspace/${wsId}/members`);
      break;
    case "calendar":
      navigateTo(`/workspace/${wsId}/calendar`);
      break;
    case "new-task":
    case "new-project":
    case "new-channel":
      console.log("open modal for", row.id);
      break;
    default: {
      const isProject = projects.value.some((p) => p.id === row.id);
      const isChannel = channels.value.some((c) => c.id === row.id);
      const isTeam = teams.value.some((t) => t.id === row.id);
      if (isProject) navigateTo(`/workspace/${wsId}/projects/${row.id}`);
      else if (isChannel) navigateTo(`/workspace/${wsId}/channels/${row.id}`);
      else if (isTeam) navigateTo(`/workspace/${wsId}/teams/${row.id}`);
      else console.log("command run", row);
      break;
    }
  }
}

const projectList = computed(() => projects.value.filter((p) => !p.deleted_at));

useHotkey(
  "Mod+D",
  () => {
    const row = findGroupRow("dashboard");
    if (row) onCommandRun(row);
  },
  { preventDefault: true },
);

useHotkey(
  "Mod+M",
  () => {
    const row = findGroupRow("members");
    if (row) onCommandRun(row);
  },
  { preventDefault: true },
);

useHotkey(
  "Mod+Shift+C",
  () => {
    const row = findGroupRow("calendar");
    if (row) onCommandRun(row);
  },
  { preventDefault: true },
);

useHotkey(
  "Mod+T",
  () => {
    const row = findGroupRow("new-task");
    if (row) onCommandRun(row);
  },
  { preventDefault: true },
);

useHotkey(
  "Mod+Shift+P",
  () => {
    const row = findGroupRow("new-project");
    if (row) onCommandRun(row);
  },
  { preventDefault: true },
);

useHotkey(
  "Mod+Shift+N",
  () => {
    const row = findGroupRow("new-channel");
    if (row) onCommandRun(row);
  },
  { preventDefault: true },
);

for (let i = 0; i < 9; i++) {
  const idx = i;
  useHotkey(
    `Mod+${idx + 1}`,
    () => {
      const p = projectList.value[idx];
      if (p) {
        const row = findGroupRow(p.id);
        if (row) onCommandRun(row);
      }
    },
    {
      enabled: computed(() => idx < projectList.value.length),
      preventDefault: true,
    },
  );
}

function findGroupRow(id: string): CommandRow | undefined {
  for (const group of commandGroups.value) {
    const found = group.rows.find((r) => r.id === id);
    if (found) return found;
  }
}
</script>

<template>
  <button
    type="button"
    class="relative flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 md:w-full md:max-w-sm"
    @click="commandMenuOpen = true"
  >
    <Icon name="hugeicons:search-01" size="16" />
    <span class="hidden flex-1 text-left md:block">Search anything</span>
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
