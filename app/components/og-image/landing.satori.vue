<script setup lang="ts">
import { GitCompare } from "@lucide/vue";
import { toast } from "~/lib/toast";
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex h-full w-full flex-col items-center justify-center bg-linear-to-br from-slate-900 to-slate-800 p-16"
  >
    <div class="mb-6 text-6xl">✓</div>
    <h1 class="mb-4 text-center text-6xl font-extrabold text-white">
      {{ title || "Zadaci" }}
    </h1>
    <p class="text-center text-2xl text-slate-300">
      {{ description || "Task Management for Modern Teams" }}
    </p>
    <button
      @click="
        toast.success('Changes saved', {
          desc: 'Atlas redesign · 12 files',
          action: { label: 'View', icon: GitCompare },
        })
      "
    >
      Save
    </button>
  </div>
</template>
