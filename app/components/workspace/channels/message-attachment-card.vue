<script setup lang="ts">
import type { MessageAttachment } from "~/types/chat";

defineProps<{ attachment: MessageAttachment }>();
</script>

<template>
  <div class="mt-2 flex max-w-sm items-center gap-3 rounded-lg border bg-background px-3 py-2">
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
      <Icon :name="attachment.icon" size="18" class="text-primary" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">{{ attachment.title }}</p>
      <p class="truncate text-xs text-muted-foreground">{{ attachment.meta }}</p>
    </div>
    <Button v-if="attachment.action === 'join'" size="sm">Join</Button>
    <template v-else>
      <Button variant="ghost" size="icon-xs" aria-label="Preview">
        <Icon name="lucide:eye" size="16" />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Download">
        <Icon name="lucide:download" size="16" />
      </Button>
    </template>
  </div>
</template>
