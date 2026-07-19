<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import ChannelHeader from "~/components/workspace/channels/channel-header.vue";
import ChannelInfoPanel from "~/components/workspace/channels/channel-info-panel.vue";
import ThreadPanel from "~/components/workspace/channels/thread-panel.vue";

const route = useRoute();
const channelId = route.params.channelId as string;
const { state, toggleInfo, closeThread, closeInfo, incrementThreadMeta } =
  useChannelPanel(channelId);

function onThreadReply(parentMessageId: string) {
  incrementThreadMeta(parentMessageId, "me");
}
</script>

<template>
  <div class="flex h-full min-h-0 overflow-hidden">
    <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChannelHeader :info-open="state.infoOpen" @toggle-info="toggleInfo" />
      <slot />
    </div>

    <AnimatePresence mode="wait">
      <motion.div
        v-if="state.infoOpen || state.activeThread"
        :key="state.activeThread ? 'thread' : 'info'"
        :initial="{ width: 0, opacity: 0 }"
        :animate="{ width: state.activeThread ? 360 : 300, opacity: 1 }"
        :exit="{ width: 0, opacity: 0 }"
        :transition="{ duration: 0.2, ease: 'easeOut' }"
        class="h-full overflow-hidden"
      >
        <ThreadPanel
          v-if="state.activeThread"
          :thread="state.activeThread"
          @close="closeThread"
          @reply-sent="onThreadReply"
        />
        <ChannelInfoPanel v-else @close="closeInfo" />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
