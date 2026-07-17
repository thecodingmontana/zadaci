<script setup lang="ts">
import type { NuxtError } from "nuxt/app";

const props = defineProps({
  error: { type: Object as () => NuxtError, required: true },
});

const is404 = computed(() => props.error?.status === 404 || props.error?.statusCode === 404);

function goHome() {
  clearError({ redirect: "/" });
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
    <div class="text-center">
      <p class="text-6xl font-bold text-brand">{{ is404 ? "404" : error?.status || "Error" }}</p>
      <h1 class="mt-4 text-2xl font-semibold text-foreground">
        {{ is404 ? "Page not found" : "Something went wrong" }}
      </h1>
      <p class="mt-2 text-muted-foreground">
        {{
          is404
            ? "The page you're looking for doesn't exist or you don't have access to it."
            : error?.message || "An unexpected error occurred."
        }}
      </p>
      <button
        class="mt-8 inline-flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
        @click="goHome"
      >
        <Icon name="hugeicons:home-01" size="16" />
        Go home
      </button>
    </div>
  </div>
</template>
