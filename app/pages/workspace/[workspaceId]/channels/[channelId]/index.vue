<script setup lang="ts">
import type { ChatMessage, Thread } from "~/types/chat";
import ChannelComposer from "~/components/workspace/channels/channel-composer.vue";
import ChannelMessages from "~/components/workspace/channels/channel-messages.vue";
import { dummyMessages, dummySystemEvents, dummyThreads } from "~/lib/dummy-data/channel";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});
const route = useRoute();
const channelId = route.params.channelId as string;
const channelName = ref<string | null>(null);
const realMessages = ref<ChatMessage[]>([]);
const messages = computed(() =>
  realMessages.value.length > 0 ? realMessages.value : dummyMessages,
);
const { state, openThread, initThreadMeta } = useChannelPanel(channelId);

for (const t of dummyThreads) {
  initThreadMeta(t.parentMessageId, {
    count: t.replies.length,
    participantIds: t.replies.map((r) => r.authorId),
  });
}

if (import.meta.client) {
  useRxDbSafe().then((db) => {
    if (!db) return;
    const channelSub = db.channels.findOne(channelId).$.subscribe((doc) => {
      channelName.value = doc?.name ?? null;
    });
    const messagesSub = db.messages.find({ selector: { channelId } }).$.subscribe((docs) => {
      realMessages.value = docs.map(mapDocToMessage);
    });
    onUnmounted(() => {
      channelSub.unsubscribe();
      messagesSub.unsubscribe();
    });
  });
}
function mapDocToMessage(doc: any): ChatMessage {
  return {
    id: doc.id,
    authorId: doc.authorId,
    content: doc.content,
    createdAt: doc.createdAt,
    status: doc.status,
    attachment: doc.attachment,
    reactions: doc.reactions,
    thread: doc.threadCount
      ? { count: doc.threadCount, participantIds: doc.threadParticipantIds }
      : undefined,
  };
}
async function onSend(content: string) {
  const db = await useRxDbSafe();
  await db?.messages.insert({
    id: crypto.randomUUID(),
    channelId,
    authorId: "me",
    content,
    createdAt: new Date().toISOString(),
    status: "sent",
  });
}
async function onReact(messageId: string, emoji: string) {
  const db = await useRxDbSafe();
  const doc = await db?.messages.findOne(messageId).exec();
  if (!doc) return;
  const reactions = [...(doc.reactions ?? [])];
  const existing = reactions.find((r) => r.emoji === emoji);
  if (existing) existing.count += 1;
  else reactions.push({ emoji, count: 1 });
  await doc.patch({ reactions });
}
async function onOpenThread(messageId: string) {
  try {
    const db = await useRxDbSafe();
    if (db) {
      const parent = await db.messages.findOne(messageId).exec();
      if (parent) {
        const replies = await db.messages.find({ selector: { threadParentId: messageId } }).exec();
        const thread: Thread = {
          id: `thread-${messageId}`,
          parentMessageId: messageId,
          parentMessage: mapDocToMessage(parent),
          replies: (replies ?? []).map(mapDocToMessage),
        };
        openThread(thread);
        return;
      }
    }
  } catch {
    // RxDB lookup failed, fall through to dummy data
  }

  const dummyThread = dummyThreads.find((t) => t.parentMessageId === messageId);
  if (dummyThread) {
    openThread(dummyThread);
    return;
  }

  const dummyMessage = dummyMessages.find((m) => m.id === messageId);
  if (dummyMessage) {
    initThreadMeta(messageId, { count: 0, participantIds: [] });
    const thread: Thread = {
      id: `thread-${messageId}`,
      parentMessageId: messageId,
      parentMessage: dummyMessage,
      replies: [],
    };
    openThread(thread);
  }
}
const channelTitle = useWorkspacePageTitle("Channel", channelName);
useSeoMeta({
  title: channelTitle,
  description: "Workspace channel — collaborate and communicate with your team in real time.",
});
</script>
<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-channel">
      <ChannelMessages
        :messages="messages"
        :system-events="dummySystemEvents"
        :thread-meta="state.threadMeta"
        @react="onReact"
        @open-thread="onOpenThread"
      />
      <ChannelComposer @send="onSend" />
    </NuxtLayout>
  </NuxtLayout>
</template>
