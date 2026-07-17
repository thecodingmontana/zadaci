<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { CommandGroup, CommandRow } from "~/components/ui/command-menu/types";
import type {
  ChannelDocType,
  ProjectDocType,
  TaskDocType,
  TeamDocType,
  WorkspaceMemberDocType,
} from "~/plugins/rxdb.client";
import CommandMenu from "~/components/ui/command-menu/command-menu.vue";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const db = useRxDb();

const members = ref<WorkspaceMemberDocType[]>([]);
const projects = ref<ProjectDocType[]>([]);
const teams = ref<TeamDocType[]>([]);
const channels = ref<ChannelDocType[]>([]);
const tasks = ref<TaskDocType[]>([]);

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
      subscribe(database.workspace_members as any, { workspace_id: wsId }, members),
      subscribe(database.projects as any, { workspace_id: wsId, deleted_at: null }, projects),
      subscribe(database.teams as any, { workspace_id: wsId, deleted_at: null }, teams),
      subscribe(database.channels as any, { workspace_id: wsId, deleted_at: null }, channels),
      subscribe(database.tasks as any, {}, tasks),
    );
  },
  { immediate: true },
);

onUnmounted(() => {
  subscriptions.forEach((fn) => fn());
});

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
    rows: members.value.map((m) => ({
      kind: "person" as const,
      id: m.id,
      name: m.username,
      role: m.role === "owner" ? "Owner" : "Team member",
      avatar: m.profile_picture_url ?? undefined,
      presence: "online" as const,
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
  console.log("command run", row);
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
