<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import WorkspaceInfo from "./workspace-info.vue";

const colorMode = useColorMode();

const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (value: boolean) => {
    colorMode.preference = value ? "dark" : "light";
  },
});

interface MenuSection {
  key: string;
  label: string;
  icon: string;
  items: string[];
}

const sections = reactive<MenuSection[]>([
  {
    key: "tasks",
    label: "Tasks",
    icon: "hugeicons:task-01",
    items: ["Design Review", "API Integration", "QA Testing"],
  },
  {
    key: "projects",
    label: "Projects",
    icon: "hugeicons:folder-01",
    items: ["Orion Mobile", "Atlas Dashboard", "Epsilon Web"],
  },
  {
    key: "teams",
    label: "Teams",
    icon: "hugeicons:user-group",
    items: ["Design", "Engineering", "Product"],
  },
]);

const openSections = reactive<Record<string, boolean>>({
  tasks: false,
  projects: false,
  teams: false,
});

const toggleSection = (key: string) => {
  openSections[key] = !openSections[key];
};

const handleAdd = (key: string, event: Event) => {
  event.stopPropagation();
  console.log("add", key);
};

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

const settingsItems = [
  { label: "General", icon: "hugeicons:settings-02" },
  { label: "Profile", icon: "hugeicons:user-circle" },
  { label: "Security", icon: "hugeicons:shield-01" },
];
</script>

<template>
  <div class="flex h-full w-64 shrink-0 flex-col border-r px-2 text-primary">
    <WorkspaceInfo />
    <div
      class="group/scroll h-full scrollbar-thin [scrollbar-color:transparent_transparent] overflow-x-hidden overflow-y-auto py-2 pr-1 hover:[scrollbar-color:var(--color-gray-300)_transparent] dark:hover:[scrollbar-color:var(--color-neutral-600)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <div class="space-y-2">
        <h3 class="font-ibm-plex-mono text-xs uppercase">Main Menu</h3>
        <div class="space-y-1">
          <div class="flex cursor-pointer items-center space-x-2 rounded bg-[#f2f2f2] p-1">
            <Icon name="hugeicons:dashboard-square-03" size="18" />
            <p>Dashboard</p>
          </div>

          <div
            class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          >
            <Icon name="hugeicons:user-multiple-02" size="18" />
            <p class="text-sm">Members</p>
          </div>

          <div
            class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          >
            <Icon name="hugeicons:calendar-03" size="18" />
            <p class="text-sm">Calendar</p>
          </div>

          <Collapsible
            v-for="section in sections"
            :key="section.key"
            :open="openSections[section.key]"
            @update:open="(val) => (openSections[section.key] = val)"
          >
            <div
              class="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
              @click="toggleSection(section.key)"
            >
              <div class="flex items-center space-x-2">
                <Icon :name="section.icon" size="18" />
                <p class="text-sm">{{ section.label }}</p>
              </div>
              <div class="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-5 w-5 opacity-0 group-hover:opacity-100"
                  @click="handleAdd(section.key, $event)"
                >
                  <Icon name="hugeicons:plus-sign" size="14" />
                </Button>
                <CollapsibleTrigger as-child @click.stop>
                  <Button variant="ghost" size="icon" class="h-5 w-5">
                    <Icon
                      name="hugeicons:arrow-down-01"
                      size="14"
                      class="transition-transform duration-200"
                      :class="openSections[section.key] ? 'rotate-180' : ''"
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent>
              <div class="mt-1 ml-6 space-y-1 border-l pl-2">
                <div
                  v-for="item in section.items"
                  :key="item"
                  class="flex cursor-pointer items-center rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                >
                  {{ item }}
                </div>
                <div
                  class="flex cursor-pointer items-center space-x-1 rounded p-1 text-sm text-muted-foreground hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
                  @click="handleAdd(section.key, $event)"
                >
                  <Icon name="hugeicons:plus-sign" size="14" />
                  <span>Add {{ section.label.slice(0, -1) }}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

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
                    :name="channel.private ? 'hugeicons:square-lock-01' : 'hugeicons:hash'"
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

      <div class="mt-4 space-y-2">
        <h3 class="font-ibm-plex-mono text-xs uppercase">Settings</h3>
        <div class="space-y-1">
          <div
            v-for="item in settingsItems"
            :key="item.label"
            class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          >
            <Icon :name="item.icon" size="18" />
            <p class="text-sm">{{ item.label }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-2 border-t pt-2 pb-2">
      <h3 class="font-ibm-plex-mono text-xs uppercase">System</h3>
      <div class="space-y-1">
        <div
          class="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        >
          <div class="flex items-center space-x-2">
            <Icon :name="isDark ? 'hugeicons:moon-02' : 'hugeicons:sun-03'" size="18" />
            <p class="text-sm">Dark Mode</p>
          </div>
          <Switch v-model="isDark" />
        </div>

        <div
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        >
          <Icon name="hugeicons:sparkles" size="18" />
          <p class="text-sm">What's New</p>
        </div>

        <div
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        >
          <Icon name="hugeicons:help-circle" size="18" />
          <p class="text-sm">Help & Support</p>
        </div>

        <div
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        >
          <Icon name="hugeicons:favourite" size="18" />
          <p class="text-sm">Donate</p>
        </div>
      </div>
    </div>
  </div>
</template>
