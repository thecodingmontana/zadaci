<script setup lang="ts">
import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import { Search as SearchIcon, X as XIcon } from "@lucide/vue";
import { MixerHorizontalIcon } from "@radix-icons/vue";
import { format } from "date-fns";
import { computed, ref } from "vue";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useProjectTasks } from "~/composables/use-project-tasks";
import { useWorkspaceMembers } from "~/composables/use-workspace-members";

const props = defineProps<{
  workspaceId: string;
  projects: ProjectDocType[];
  tasks: TaskDocType[];
  range?: "today" | "daily" | "weekly" | "monthly" | "yearly";
}>();

const RANGE_DAYS: Record<NonNullable<typeof props.range>, number> = {
  today: 0,
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

const { data: members } = useWorkspaceMembers(computed(() => props.workspaceId));

const memberName = computed(() => {
  const map = new Map<string, string>();
  for (const m of members.value ?? []) {
    map.set(m.id, m.user.username ?? m.user.email ?? "Unknown");
  }
  return map;
});

// Assignees per task from the Tier 1 task_assignees collection (member_id only).
const assigneesByTask = ref<Map<string, string[]>>(new Map());

async function subscribeAssignees() {
  const db = await useRxDbSafe();
  if (!db) return;
  const sub = db.task_assignees.find({ selector: { deleted_at: null } }).$.subscribe((docs) => {
    const map = new Map<string, string[]>();
    for (const row of docs) {
      const list = map.get(row.task_id) ?? [];
      list.push(row.member_id);
      map.set(row.task_id, list);
    }
    assigneesByTask.value = map;
  });
  onUnmounted(() => sub.unsubscribe());
}

subscribeAssignees();

const projectNames = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.projects) map.set(p.id, p.title);
  return map;
});

const STATUS_STYLES: Record<TaskDocType["status"], { label: string; badge: string }> = {
  idea: { label: "Idea", badge: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
  todo: { label: "Todo", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  in_progress: {
    label: "In Progress",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  in_review: { label: "In Review", badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  completed: { label: "Completed", badge: "bg-green-500/15 text-green-600 dark:text-green-400" },
  abandoned: { label: "Abandoned", badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const searchQuery = ref("");

const topLevel = computed(() => props.tasks.filter((t) => !t.parent_task_id && !t.deleted_at));

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const windowMs = (RANGE_DAYS[props.range ?? "daily"] ?? 1) * 86_400_000;
  const cutoff = Date.now() - windowMs;
  let list = topLevel.value.filter((t) => new Date(t.updated_at).getTime() >= cutoff);
  list = list
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (!q) return list.slice(0, 8);
  return list
    .filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (projectNames.value.get(t.project_id) ?? "").toLowerCase().includes(q),
    )
    .slice(0, 8);
});

const { subtaskCounts } = useProjectTasks(() => ({ projectId: props.projects[0]?.id }));

function progressFor(task: TaskDocType): number | null {
  if (task.status === "completed") return 100;
  const counts = subtaskCounts.value[task.id];
  if (!counts || counts.total === 0) return null;
  return Math.round((counts.completed / counts.total) * 100);
}

function assigneeNames(task: TaskDocType): string[] {
  const ids = assigneesByTask.value.get(task.id) ?? [];
  if (ids.length === 0) return ["Unassigned"];
  return ids.map((id) => memberName.value.get(id) ?? "Unknown");
}

function openTask(task: TaskDocType) {
  navigateTo(`/workspace/${props.workspaceId}/tasks/${task.id}`);
}
</script>

<template>
  <div class="rounded-xl border bg-card shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-2.5 border-b p-4">
      <div>
        <h2 class="text-base font-semibold tracking-tight">Recent Tasks</h2>
        <p class="text-sm text-muted-foreground">Most recently updated first</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative w-full lg:w-56">
          <SearchIcon
            class="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input v-model="searchQuery" class="h-8 w-full ps-9" placeholder="Search tasks..." />
          <Button
            v-if="searchQuery.length > 0"
            variant="ghost"
            class="absolute end-1.5 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
            @click="searchQuery = ''"
          >
            <XIcon class="size-4" />
          </Button>
        </div>
        <Button variant="outline" class="h-8">
          <MixerHorizontalIcon class="size-4" />
          <span class="hidden md:block">Filter</span>
        </Button>
      </div>
    </div>

    <div class="max-h-[34rem] overflow-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th class="px-4 py-2.5 font-medium">Task</th>
            <th class="px-4 py-2.5 font-medium">Assigned To</th>
            <th class="hidden px-4 py-2.5 font-medium lg:table-cell">Project</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
            <th class="hidden px-4 py-2.5 font-medium md:table-cell">Progress</th>
            <th class="px-4 py-2.5 font-medium">Due Date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in filtered"
            :key="task.id"
            class="cursor-pointer border-b last:border-b-0 hover:bg-accent/40"
            @click="openTask(task)"
          >
            <td class="max-w-64 truncate px-4 py-3 font-medium">{{ task.name }}</td>
            <td class="px-4 py-3">
              <span class="text-muted-foreground">{{ assigneeNames(task).join(", ") }}</span>
            </td>
            <td class="hidden max-w-40 truncate px-4 py-3 text-muted-foreground lg:table-cell">
              {{ projectNames.get(task.project_id) ?? "—" }}
            </td>
            <td class="px-4 py-3">
              <Badge
                variant="secondary"
                class="gap-1 rounded px-1.5 py-0 font-medium"
                :class="STATUS_STYLES[task.status]?.badge"
              >
                {{ STATUS_STYLES[task.status]?.label ?? task.status }}
              </Badge>
            </td>
            <td class="hidden px-4 py-3 md:table-cell">
              <div v-if="progressFor(task) !== null" class="flex items-center gap-2">
                <div class="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-brand"
                    :style="{ width: `${progressFor(task)}%` }"
                  />
                </div>
                <span class="text-xs text-muted-foreground tabular-nums">
                  {{ progressFor(task) }}%
                </span>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3">
              <span v-if="task.due_date" class="text-muted-foreground">
                {{ format(new Date(task.due_date), "MMM d, yyyy") }}
              </span>
              <span v-else class="text-muted-foreground/60">—</span>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks match your search.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
