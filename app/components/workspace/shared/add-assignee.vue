<script setup lang="ts">
import type { TeamDocType } from "~/plugins/rxdb.client";
import type { ProjectMembers } from "~/types";
import { Check, ChevronDown, Loader2, Users } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

const props = defineProps<{
  assignees: ProjectMembers[];
  onAddAssiginees: (payload: ProjectMembers) => void;
  onRemoveAssignee: (payload: ProjectMembers) => void;
}>();

const workspaceStore = useWorkspaceStore();

const activeWorkspace = computed(() => workspaceStore?.activeWorkspace);

const workspaceIdRef = computed(() => activeWorkspace.value?.id as string | undefined);
const { data: workspaceMembers } = useWorkspaceMembers(workspaceIdRef);
const { user } = useUserSession();

const currentMemberId = computed(() => {
  if (!user.value?.id || !workspaceMembers.value) return null;
  const member = workspaceMembers.value.find((m) => m.userId === user.value!.id);
  return member?.id ?? null;
});

const teammates = computed(() => {
  if (!workspaceMembers.value) return [];
  return workspaceMembers.value.map((m: any) => ({
    member_id: m.id,
    username: m.user?.username ?? m.user?.email ?? "Unknown",
    avatar: m.user?.profilePictureUrl ?? null,
  }));
});

const open = ref(false);
const teams = ref<TeamDocType[]>([]);
const loadingTeams = ref(false);

const db = useRxDbSafe();

onMounted(async () => {
  const database = await db;
  if (!database?.teams || !workspaceIdRef.value) return;
  loadingTeams.value = true;
  const sub = database.teams
    .find({
      selector: {
        workspace_id: workspaceIdRef.value,
        deleted_at: null,
      },
    })
    .$.subscribe((docs) => {
      teams.value = docs;
      loadingTeams.value = false;
    });
  onUnmounted(() => sub.unsubscribe());
});

const hasTeams = computed(() => teams.value.length > 0);

const teamResolving = ref<Record<string, boolean>>({});

const onSelectAssignee = (teammate: any) => {
  const alreadyExists = props.assignees.some((a) => a.member_id === teammate.member_id);
  if (alreadyExists) {
    props.onRemoveAssignee(teammate);
  } else {
    props.onAddAssiginees(teammate);
  }
  open.value = false;
};

const onSelectTeam = async (team: TeamDocType) => {
  if (teamResolving.value[team.id]) return;
  teamResolving.value = { ...teamResolving.value, [team.id]: true };

  try {
    const members = await $fetch<any[]>(
      `/api/workspace/${workspaceIdRef.value}/teammates/team-members?team_id=${team.id}`,
    );

    for (const m of members) {
      const memberId = m.memberId ?? m.member_id;
      if (!memberId) continue;
      const alreadyExists = props.assignees.some((a) => a.member_id === memberId);
      if (!alreadyExists) {
        props.onAddAssiginees({
          member_id: memberId,
          username: m.username ?? "Team Member",
          avatar: m.avatar ?? null,
        });
      }
    }
  } catch (err) {
    console.error("Failed to resolve team members", err);
  } finally {
    teamResolving.value = { ...teamResolving.value, [team.id]: false };
    open.value = false;
  }
};
</script>

<template>
  <div class="w-full space-y-2">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          role="combobox"
          :aria-expanded="open"
          class="w-full cursor-pointer justify-between bg-background px-3 font-normal hover:bg-background dark:border dark:border-ring"
        >
          <span class="text-muted-foreground">Select teammate or team</span>
          <ChevronDown
            :size="16"
            :stroke-width="2"
            class="shrink-0 text-muted-foreground/80"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-full min-w-[var(--reka-popper-anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search teammate or team..." />
          <CommandList>
            <CommandEmpty>No teammates or teams found.</CommandEmpty>
            <CommandGroup v-if="hasTeams" heading="Teams">
              <CommandItem
                v-for="team in teams"
                :key="team.id"
                :value="team"
                class="cursor-pointer"
                @select="() => onSelectTeam(team)"
              >
                <Users :size="16" class="mr-2 shrink-0 text-muted-foreground" />
                <span class="flex-1 leading-none">{{ team.name }}</span>
                <Loader2
                  v-if="teamResolving[team.id]"
                  :size="14"
                  class="shrink-0 animate-spin text-muted-foreground"
                />
              </CommandItem>
            </CommandGroup>
            <CommandSeparator v-if="hasTeams" />
            <CommandGroup heading="Teammates">
              <CommandItem
                v-for="teammate in teammates"
                :key="teammate.member_id"
                :value="teammate"
                class="cursor-pointer"
                @select="() => onSelectAssignee(teammate)"
              >
                <Avatar>
                  <AvatarImage :src="teammate.avatar ?? undefined" :alt="teammate.username" />
                  <AvatarFallback>{{ (teammate.username[0] ?? "?").toUpperCase() }}</AvatarFallback>
                </Avatar>
                <span class="leading-none">
                  {{ teammate.username }}
                  <span v-if="teammate.member_id === currentMemberId" class="text-muted-foreground"
                    >(You)</span
                  >
                </span>
                <Check
                  v-if="assignees.some((a) => a.member_id === teammate.member_id)"
                  :size="16"
                  stroke-width="2"
                  class="ml-auto"
                />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>
