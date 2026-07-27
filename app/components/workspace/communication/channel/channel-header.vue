<script setup lang="ts">
import { useRxDbSafe } from "~/composables/use-rxdb";

const props = defineProps<{
  infoOpen: boolean;
  channelId: string;
  workspaceId: string;
}>();
const emit = defineEmits<{ toggleInfo: [] }>();

const channelName = ref("# General");
const memberCount = ref(0);
const channelMemberIds = ref<string[]>([]);
const onlineCount = ref(0);

const presence = useWorkspacePresence(() => props.workspaceId);
const { data: workspaceMembers } = useWorkspaceMembers(computed(() => props.workspaceId));

const memberIdToUserId = computed(() => {
  if (!workspaceMembers.value) return new Map<string, string>();
  return new Map(workspaceMembers.value.map((m: any) => [m.id, m.userId]));
});

watchEffect(() => {
  const userIds = presence.onlineUserIds.value;
  const memberIds = channelMemberIds.value;
  const map = memberIdToUserId.value;
  if (!userIds.size || !memberIds.length || !map.size) {
    onlineCount.value = 0;
    return;
  }
  let count = 0;
  for (const memberId of memberIds) {
    const uid = map.get(memberId);
    if (uid && userIds.has(uid)) count++;
  }
  onlineCount.value = count;
});

onMounted(async () => {
  presence.start();

  const rxdb = await useRxDbSafe();
  if (!rxdb) return;

  const channelSub = rxdb.channels.findOne(props.channelId).$.subscribe((doc: any) => {
    channelName.value = doc?.name ? `# ${doc.name}` : "# Unknown";
  });

  const membersSub = rxdb.channel_members
    .find({ selector: { channel_id: props.channelId } })
    .$.subscribe((docs: any[]) => {
      const seen = new Set<string>();
      const unique = docs.filter((d: any) => {
        if (seen.has(d.member_id)) return false;
        seen.add(d.member_id);
        return true;
      });
      memberCount.value = unique.length;
      channelMemberIds.value = unique.map((d: any) => d.member_id);
    });

  onUnmounted(() => {
    channelSub.unsubscribe();
    membersSub.unsubscribe();
  });
});
</script>

<template>
  <header class="flex items-center justify-between border-b px-3 py-3">
    <div>
      <p class="text-sm font-semibold">{{ channelName }}</p>
      <p class="text-xs text-muted-foreground">
        {{ memberCount }} Member{{ memberCount === 1 ? "" : "s" }} ·
        <span :class="onlineCount > 0 ? 'text-green-600' : 'text-muted-foreground'">
          {{ onlineCount }} Online
        </span>
      </p>
    </div>
    <div class="flex items-center gap-2">
      <Button
        :variant="infoOpen ? 'secondary' : 'ghost'"
        size="icon-xs"
        aria-label="Toggle channel info"
        @click="emit('toggleInfo')"
      >
        <Icon name="lucide:panel-right" size="16" />
      </Button>
    </div>
  </header>
</template>
