<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

interface Channel {
  name: string;
  private: boolean;
  unread?: number;
  bold?: boolean;
}

type PresenceStatus = "online" | "busy" | "away" | "offline";

interface DirectMessage {
  name: string;
  role: string;
  avatar: string;
  status: PresenceStatus;
  unread?: number;
  bold?: boolean;
}

const channels = reactive<Channel[]>([
  { name: "General", private: false, unread: 3 },
  { name: "Design Status", private: false, unread: 2, bold: true },
  { name: "Development", private: true },
  { name: "Reports", private: true },
  { name: "Front-end", private: true },
]);

const directMessages = reactive<DirectMessage[]>([
  {
    name: "Albert Flores",
    role: "Product Designer",
    avatar: "https://i.pravatar.cc/150?img=12",
    status: "online",
    unread: 2,
    bold: true,
  },
  {
    name: "Arlene McCoy",
    role: "Frontend Engineer",
    avatar: "https://i.pravatar.cc/150?img=32",
    status: "busy",
  },
  {
    name: "Jane Cooper",
    role: "Backend Engineer",
    avatar: "https://i.pravatar.cc/150?img=45",
    status: "away",
  },
  {
    name: "Cameron Williamson",
    role: "QA Engineer",
    avatar: "https://i.pravatar.cc/150?img=51",
    status: "offline",
  },
  {
    name: "Jacob Jones",
    role: "Project Manager",
    avatar: "https://i.pravatar.cc/150?img=60",
    status: "online",
  },
]);

const statusStyles: Record<PresenceStatus, string> = {
  online: "bg-green-500",
  busy: "bg-red-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

const statusLabels: Record<PresenceStatus, string> = {
  online: "Online",
  busy: "Busy",
  away: "Away",
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
          <div
            v-for="channel in channels"
            :key="channel.name"
            class="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
            :class="channel.bold ? 'bg-[#f2f2f2] dark:bg-neutral-800' : ''"
          >
            <div class="flex items-center space-x-2">
              <Icon
                :name="channel.private ? 'hugeicons:square-lock-01' : 'solar:hashtag-chat-linear'"
                size="16"
                class="text-muted-foreground"
              />
              <p class="text-sm" :class="channel.bold ? 'font-semibold' : ''">
                {{ channel.name }}
              </p>
            </div>
            <span v-if="channel.unread" class="text-xs text-muted-foreground">
              {{ channel.unread }}
            </span>
          </div>

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
          <div
            v-for="dm in directMessages"
            :key="dm.name"
            class="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          >
            <div class="flex min-w-0 items-center space-x-2">
              <Popover>
                <PopoverTrigger as-child @click.stop>
                  <div class="relative shrink-0 cursor-pointer">
                    <Avatar class="h-5 w-5">
                      <AvatarImage :src="dm.avatar" :alt="dm.name" />
                      <AvatarFallback class="text-[10px]">
                        {{ initials(dm.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      class="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ring-2 ring-background"
                      :class="statusStyles[dm.status]"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" class="w-56 p-3">
                  <div class="flex items-center space-x-3">
                    <div class="relative shrink-0">
                      <Avatar class="h-9 w-9">
                        <AvatarImage :src="dm.avatar" :alt="dm.name" />
                        <AvatarFallback>{{ initials(dm.name) }}</AvatarFallback>
                      </Avatar>
                      <span
                        class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background"
                        :class="statusStyles[dm.status]"
                      />
                    </div>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold">{{ dm.name }}</p>
                      <p class="truncate text-xs text-muted-foreground">{{ dm.role }}</p>
                    </div>
                  </div>
                  <div class="mt-3 flex items-center space-x-1.5 text-xs text-muted-foreground">
                    <span class="h-1.5 w-1.5 rounded-full" :class="statusStyles[dm.status]" />
                    <span>{{ statusLabels[dm.status] }}</span>
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
              <p class="truncate text-sm" :class="dm.bold ? 'font-semibold' : ''">
                {{ dm.name }}
              </p>
            </div>
            <Badge
              v-if="dm.unread"
              variant="destructive"
              class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px]"
            >
              {{ dm.unread }}
            </Badge>
          </div>

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
