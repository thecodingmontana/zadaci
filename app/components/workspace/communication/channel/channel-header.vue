<script setup lang="ts">
defineProps<{ infoOpen: boolean }>();
const emit = defineEmits<{ toggleInfo: [] }>();
</script>

<template>
  <header class="flex items-center justify-between border-b px-3 py-3">
    <div>
      <p class="text-sm font-semibold"># General</p>
      <p class="text-xs text-muted-foreground">
        12 Members · <span class="text-green-600">4 Online</span>
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
