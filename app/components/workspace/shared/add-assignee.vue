<script setup lang="ts">
import type { ProjectMembers } from "~/types";
import { Check, ChevronDown } from "@lucide/vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
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

const onSelectAssignee = (teammate: any) => {
  const alreadyExists = props.assignees.some((a) => a.member_id === teammate.member_id);
  if (alreadyExists) {
    props.onRemoveAssignee(teammate);
  } else {
    props.onAddAssiginees(teammate);
  }
  open.value = false;
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
          <span class="text-muted-foreground">Select teammate</span>
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
          <CommandInput placeholder="Search teammate.." />
          <CommandList>
            <CommandEmpty>No teammate found.</CommandEmpty>
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
