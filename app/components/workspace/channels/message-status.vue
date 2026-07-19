<script setup lang="ts">
import type { MessageStatus } from "~/types/chat";

const props = defineProps<{ status: MessageStatus }>();
</script>

<template>
  <Icon
    :name="props.status === 'sent' ? 'lucide:check' : 'lucide:check-check'"
    size="14"
    :class="[props.status === 'read' ? 'text-blue-500' : 'text-muted-foreground']"
  />
</template>
