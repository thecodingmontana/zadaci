import type { Thread } from "~/types/chat";

export interface ThreadMeta {
  count: number;
  participantIds: string[];
}

interface ChannelPanelState {
  infoOpen: boolean;
  activeThread: Thread | null;
  threadMeta: Record<string, ThreadMeta>;
}

export function useChannelPanel(channelId: string) {
  const state = useState<ChannelPanelState>(`channel-panel:${channelId}`, () => ({
    infoOpen: false,
    activeThread: null,
    threadMeta: {},
  }));

  function toggleInfo() {
    state.value.activeThread = null;
    state.value.infoOpen = !state.value.infoOpen;
  }
  function openThread(thread: Thread) {
    state.value.infoOpen = false;
    state.value.activeThread = thread;
  }
  function closeThread() {
    state.value.activeThread = null;
  }
  function closeInfo() {
    state.value.infoOpen = false;
  }

  function initThreadMeta(messageId: string, meta: ThreadMeta) {
    state.value.threadMeta[messageId] = meta;
  }

  function incrementThreadMeta(messageId: string, authorId: string) {
    const meta = state.value.threadMeta[messageId];
    if (meta) {
      meta.count += 1;
      if (!meta.participantIds.includes(authorId)) {
        meta.participantIds.push(authorId);
      }
    } else {
      state.value.threadMeta[messageId] = { count: 1, participantIds: [authorId] };
    }
  }

  return {
    state,
    toggleInfo,
    openThread,
    closeThread,
    closeInfo,
    initThreadMeta,
    incrementThreadMeta,
  };
}
