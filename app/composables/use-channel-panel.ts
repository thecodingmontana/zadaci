// ~/composables/use-channel-panel.ts
import type { Thread } from "~/types/chat";

interface ChannelPanelState {
  infoOpen: boolean;
  activeThread: Thread | null;
}

export function useChannelPanel(channelId: string) {
  const state = useState<ChannelPanelState>(`channel-panel:${channelId}`, () => ({
    infoOpen: false,
    activeThread: null,
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

  return { state, toggleInfo, openThread, closeThread, closeInfo };
}
