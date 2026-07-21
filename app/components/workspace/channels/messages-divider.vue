<script setup lang="ts">
import { Marker, MarkerContent } from "@/components/ui/marker";
defineProps<{ label: string; align?: "center" | "end" }>();
</script>

<template>
  <div class="my-3 flex items-center" :class="[align === 'end' ? 'justify-end' : 'justify-center']">
    <Marker variant="separator">
      <MarkerContent>
        {{ label }}
      </MarkerContent>
    </Marker>
  </div>
</template>
