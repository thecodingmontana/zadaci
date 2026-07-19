<script setup lang="ts">
defineProps<{ infoOpen: boolean }>();
const emit = defineEmits<{ toggleInfo: [] }>();
</script>

<template>
  <header class="flex items-center justify-between border-b px-3 py-3">
    <div class="flex items-center gap-x-1">
      <Icon name="hugeicons:message-multiple-01" size="16" />
      <p class="text-sm text-muted-foreground">Channels</p>
      <Icon name="iconoir:slash" size="16" class="text-muted-foreground" />
      <p class="text-sm font-semibold"># General</p>
    </div>

    <div class="flex items-center gap-2">
      <Button variant="ghost" size="icon-xs" aria-label="Notifications">
        <Icon name="lucide:bell" size="16" />
      </Button>
      <Button
        :variant="infoOpen ? 'secondary' : 'ghost'"
        size="icon-xs"
        aria-label="Toggle channel info"
        @click="emit('toggleInfo')"
      >
        <Icon name="lucide:panel-right" size="16" />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="More options">
        <Icon name="lucide:more-vertical" size="16" />
      </Button>
    </div>
  </header>
</template>
