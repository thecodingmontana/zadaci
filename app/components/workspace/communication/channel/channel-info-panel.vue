<script setup lang="ts">
import type { ChannelMemberDocType } from "~/plugins/rxdb.client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const props = defineProps<{
  channelId: string;
  workspaceId: string;
}>();

const emit = defineEmits<{ close: [] }>();

// Tier 1: channel doc from RxDB
const db = useRxDb();
const channelDoc = ref<{
  id: string;
  name: string | null;
  created_by: string;
  created_at: string;
} | null>(null);
const channelMembers = ref<ChannelMemberDocType[]>([]);
const membersLoading = ref(true);
const createdByLoading = ref(true);

// Tier 2: workspace members
const workspaceIdRef = computed(() => props.workspaceId);
const { data: workspaceMembers, isLoading: wsMembersLoading } = useWorkspaceMembers(workspaceIdRef);

const isSystemChannel = computed(() => {
  return channelDoc.value?.name?.toLowerCase() === "general";
});

const createdByName = computed(() => {
  if (!channelDoc.value || !workspaceMembers.value) return "Loading...";
  if (isSystemChannel.value) return "System";
  const member = workspaceMembers.value.find((m: any) => m.userId === channelDoc.value!.created_by);
  return member?.user?.username ?? member?.user?.email ?? "System";
});

const createdAtFormatted = computed(() => {
  if (!channelDoc.value) return "";
  return new Date(channelDoc.value.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

const resolvedMembers = computed(() => {
  if (!channelMembers.value || !workspaceMembers.value) return [];
  return channelMembers.value
    .map((cm) => {
      const ws = workspaceMembers.value.find((m: any) => m.id === cm.member_id);
      return {
        id: cm.member_id,
        name: ws?.user?.username ?? ws?.user?.email ?? "Unknown",
        avatar: ws?.user?.profilePictureUrl ?? null,
        email: ws?.user?.email ?? "",
      };
    })
    .filter(Boolean);
});

if (db && import.meta.client) {
  db.channels.findOne(props.channelId).$.subscribe((doc) => {
    channelDoc.value = doc ?? null;
    createdByLoading.value = false;
  });

  db.channel_members.find({ selector: { channel_id: props.channelId } }).$.subscribe((docs) => {
    channelMembers.value = docs ?? [];
    membersLoading.value = false;
  });
}

const showCreatedByLoading = computed(() => {
  return createdByLoading.value || wsMembersLoading.value;
});

const showMembersLoading = computed(() => {
  return membersLoading.value || wsMembersLoading.value;
});
</script>

<template>
  <div class="flex h-full w-80 flex-col border-l">
    <div class="flex items-center justify-between border-b px-4 py-3">
      <div>
        <p class="text-sm font-semibold"># {{ channelDoc?.name ?? "Channel" }}</p>
        <p class="text-xs text-muted-foreground">Channels</p>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Close panel" @click="emit('close')">
        <Icon name="lucide:x" size="16" />
      </Button>
    </div>

    <Tabs default-value="info" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="mx-4 mt-3">
        <TabsTrigger value="info" class="flex-1">Info</TabsTrigger>
        <TabsTrigger value="files" class="flex-1">Files</TabsTrigger>
        <TabsTrigger value="links" class="flex-1">Links</TabsTrigger>
      </TabsList>

      <TabsContent value="info" class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p class="mb-3 text-xs font-medium text-muted-foreground">Channel Info</p>

        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="flex shrink-0 items-center gap-2 text-muted-foreground">
              <Icon name="lucide:user" size="14" /> Created by
            </dt>
            <dd class="flex items-center gap-1.5 text-right font-medium">
              <template v-if="!showCreatedByLoading && channelDoc">
                <span class="truncate">{{ createdByName }}</span>
                <Avatar class="h-5 w-5 shrink-0">
                  <AvatarImage />
                  <AvatarFallback>{{ (createdByName[0] ?? "?").toUpperCase() }}</AvatarFallback>
                </Avatar>
              </template>
              <template v-else>
                <span class="text-muted-foreground">Loading...</span>
              </template>
            </dd>
          </div>

          <div class="flex items-center justify-between gap-3">
            <dt class="flex shrink-0 items-center gap-2 text-muted-foreground">
              <Icon name="lucide:calendar" size="14" /> Date created
            </dt>
            <dd class="text-right font-medium">{{ createdAtFormatted || "—" }}</dd>
          </div>

          <div class="flex items-center justify-between gap-3">
            <dt class="flex shrink-0 items-center gap-2 text-muted-foreground">
              <Icon name="lucide:circle" size="14" /> Status
            </dt>
            <dd class="text-right">
              <Badge variant="secondary" class="text-green-600">• Active</Badge>
            </dd>
          </div>

          <div class="flex items-center justify-between gap-3">
            <dt class="flex shrink-0 items-center gap-2 text-muted-foreground">
              <Icon name="lucide:eye" size="14" /> Type
            </dt>
            <dd class="text-right font-medium">Public Channel</dd>
          </div>
        </dl>

        <Separator class="my-6" />

        <div class="flex items-center justify-between">
          <p class="text-xs font-medium text-muted-foreground">
            Members
            <span v-if="resolvedMembers.length">({{ resolvedMembers.length }})</span>
          </p>
          <Button variant="ghost" size="icon-xs" aria-label="Add member">
            <Icon name="lucide:plus" size="14" />
          </Button>
        </div>

        <div v-if="showMembersLoading" class="mt-3 text-sm text-muted-foreground">
          Loading members...
        </div>
        <div v-else-if="resolvedMembers.length === 0" class="mt-3 text-sm text-muted-foreground">
          No members yet.
        </div>
        <div v-else class="mt-3 space-y-3">
          <div v-for="member in resolvedMembers" :key="member.id" class="flex items-center gap-3">
            <Avatar class="h-8 w-8 shrink-0">
              <AvatarImage :src="member.avatar ?? undefined" />
              <AvatarFallback>{{ (member.name[0] ?? "?").toUpperCase() }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ member.name }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ member.email }}</p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="files" class="flex-1 px-4 py-3 text-sm text-muted-foreground">
        No files shared yet.
      </TabsContent>
      <TabsContent value="links" class="flex-1 px-4 py-3 text-sm text-muted-foreground">
        No links shared yet.
      </TabsContent>
    </Tabs>
  </div>
</template>
