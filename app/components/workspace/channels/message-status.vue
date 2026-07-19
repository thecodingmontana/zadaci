<script setup lang="ts">
defineProps<{ status: "sent" | "delivered" | "seen" }>();
</script>

<template>
  <Icon v-if="status === 'sent'" name="lucide:check" size="14" class="text-muted-foreground" />
  <Icon
    v-else-if="status === 'delivered'"
    name="lucide:check-check"
    size="14"
    class="text-muted-foreground"
  />
  <Icon v-else name="lucide:check-check" size="14" class="text-blue-500" />
</template>
