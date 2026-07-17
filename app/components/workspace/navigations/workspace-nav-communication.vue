<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type {
  ChannelDocType,
  ChannelMemberDocType,
  UserStatusDocType,
  WorkspaceMemberDocType,
} from "~/plugins/rxdb.client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const db = useRxDb();
const { user } = useUserSession();

const channels = ref<ChannelDocType[]>([]);
const channelMembers = ref<ChannelMemberDocType[]>([]);
const workspaceMembers = ref<WorkspaceMemberDocType[]>([]);
const userStatuses = ref<UserStatusDocType[]>([]);

function subscribe<T>(
  collection: RxCollection<T> | undefined,
  selector: any,
  target: { value: T[] },
) {
  if (!collection) return;
  const sub = collection.find({ selector }).$.subscribe((docs) => {
    target.value = docs;
  });
  onUnmounted(() => sub.unsubscribe());
}

watch(
  () => db,
  (database) => {
    if (!database) return;
    const wsId = workspaceId.value;
    if (!wsId) return;

    subscribe(database.channels as any, { workspace_id: wsId, deleted_at: null }, channels);
    subscribe(database.channel_members as any, {}, channelMembers);
    subscribe(database.workspace_members as any, { workspace_id: wsId }, workspaceMembers);
    subscribe(database.user_status as any, {}, userStatuses);
  },
  { immediate: true },
);

const publicChannels = computed(() =>
  channels.value.filter((c) => c.type === "public" || c.type === "private"),
);

const dmMembers = computed(() => workspaceMembers.value);

const statusMap = computed(() => {
  const map = new Map<string, UserStatusDocType>();
  for (const s of userStatuses.value) {
    map.set(s.user_id, s);
  }
  return map;
});

function getStatus(userId: string): UserStatusDocType | undefined {
  return statusMap.value.get(userId);
}

const statusStyles: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-red-500",
  away: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  available: "Online",
  busy: "Busy",
  away: "Away",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

const openCommunication = reactive<Record<string, boolean>>({
  channels: true,
  directMessages: true,
});

const toggleCommunication = (key: string) => {
  openCommunication[key] = !openCommunication[key];
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const handleAdd = (key: string, event: Event) => {
  event.stopPropagation();
  console.log("add", key);
};

function resolveMemberStatus(member?: WorkspaceMemberDocType): string {
  if (!member) return "offline";
  const status = getStatus(member.user_id);
  // user_status row exists only when user explicitly set a status
  // no row means they haven't set one → default to "available" (online)
  return status?.status ?? "available";
}

function resolveMemberRole(member?: WorkspaceMemberDocType): string {
  return member?.role === "owner" ? "Owner" : member?.role === "guest" ? "Guest" : "Team member";
}
</script>

<template>
  <div class="mt-4 space-y-2">
    <h3 class="font-ibm-plex-mono text-xs uppercase">Communication</h3>

    <Collapsible
      :open="openCommunication.channels"
      @update:open="(val) => (openCommunication.channels = val)"
    >
      <div
        class="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        @click="toggleCommunication('channels')"
      >
        <div class="flex items-center space-x-2">
          <Icon name="hugeicons:message-multiple-01" size="16" />
          <p class="text-sm font-medium">Channels</p>
        </div>
        <div class="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-5 w-5 opacity-0 group-hover:opacity-100"
            @click="handleAdd('channels', $event)"
          >
            <Icon name="hugeicons:plus-sign" size="14" />
          </Button>
          <CollapsibleTrigger as-child @click.stop>
            <Button variant="ghost" size="icon" class="h-5 w-5">
              <Icon
                name="hugeicons:arrow-down-01"
                size="14"
                class="transition-transform duration-200"
                :class="openCommunication.channels ? 'rotate-180' : ''"
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div class="mt-1 space-y-1">
          <NuxtLink
            v-for="channel in publicChannels"
            :key="channel.id"
            :to="`/workspace/${workspaceId}/channels/${channel.id}`"
            class="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          >
            <div class="flex items-center space-x-2">
              <Icon
                :name="
                  channel.type === 'private'
                    ? 'hugeicons:square-lock-01'
                    : 'solar:hashtag-chat-linear'
                "
                size="16"
                class="text-muted-foreground"
              />
              <p class="text-sm">{{ channel.name }}</p>
            </div>
          </NuxtLink>

          <div
            class="flex cursor-pointer items-center space-x-2 rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
            @click="handleAdd('channel', $event)"
          >
            <Icon name="hugeicons:plus-sign" size="14" />
            <span>Add channel</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <Collapsible
      :open="openCommunication.directMessages"
      @update:open="(val) => (openCommunication.directMessages = val)"
    >
      <div
        class="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        @click="toggleCommunication('directMessages')"
      >
        <div class="flex items-center space-x-2">
          <Icon name="hugeicons:user-account" size="16" />
          <p class="text-sm font-medium">Direct Messages</p>
        </div>
        <div class="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-5 w-5 opacity-0 group-hover:opacity-100"
            @click="handleAdd('directMessages', $event)"
          >
            <Icon name="hugeicons:plus-sign" size="14" />
          </Button>
          <CollapsibleTrigger as-child @click.stop>
            <Button variant="ghost" size="icon" class="h-5 w-5">
              <Icon
                name="hugeicons:arrow-down-01"
                size="14"
                class="transition-transform duration-200"
                :class="openCommunication.directMessages ? 'rotate-180' : ''"
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div class="mt-1 space-y-1">
          <NuxtLink
            v-for="dm in dmMembers"
            :key="dm.id"
            :to="`/workspace/${workspaceId}/conversations/${dm.user_id}`"
            class="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          >
            <div class="flex min-w-0 items-center space-x-2">
              <Popover>
                <PopoverTrigger as-child @click.stop>
                  <div class="relative shrink-0 cursor-pointer">
                    <Avatar class="h-5 w-5">
                      <AvatarImage :src="dm.profile_picture_url ?? ''" :alt="dm.username" />
                      <AvatarFallback class="text-[10px]">
                        {{ initials(dm.username) }}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      class="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ring-2 ring-background"
                      :class="statusStyles[resolveMemberStatus(dm)]"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" class="w-56 p-3">
                  <div class="flex items-center space-x-3">
                    <div class="relative shrink-0">
                      <Avatar class="h-9 w-9">
                        <AvatarImage :src="dm.profile_picture_url ?? ''" :alt="dm.username" />
                        <AvatarFallback>{{ initials(dm.username) }}</AvatarFallback>
                      </Avatar>
                      <span
                        class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background"
                        :class="statusStyles[resolveMemberStatus(dm)]"
                      />
                    </div>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold">
                        {{ dm.username }}
                        <span v-if="dm.user_id === user?.id" class="text-muted-foreground"
                          >(You)</span
                        >
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        {{ resolveMemberRole(dm) }}
                      </p>
                    </div>
                  </div>
                  <div class="mt-3 flex items-center space-x-1.5 text-xs text-muted-foreground">
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="statusStyles[resolveMemberStatus(dm)]"
                    />
                    <span>{{ statusLabels[resolveMemberStatus(dm)] ?? "Offline" }}</span>
                  </div>
                  <div class="mt-3 flex space-x-2">
                    <Button size="sm" class="h-7 flex-1 text-xs">
                      <Icon name="hugeicons:message-01" size="14" class="mr-1" />
                      Message
                    </Button>
                    <Button size="sm" variant="outline" class="h-7 flex-1 text-xs">
                      <Icon name="hugeicons:call-02" size="14" class="mr-1" />
                      Call
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <p class="truncate text-sm">
                {{ dm.username }}
                <span v-if="dm.user_id === user?.id" class="text-muted-foreground">(You)</span>
              </p>
            </div>
          </NuxtLink>

          <div
            class="flex cursor-pointer items-center space-x-2 rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
            @click="handleAdd('directMessage', $event)"
          >
            <Icon name="hugeicons:plus-sign" size="14" />
            <span>Add new user</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
