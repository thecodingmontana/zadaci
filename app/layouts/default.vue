<script setup lang="ts">
import Toaster from "~/components/toast/toaster.vue";
useHead({
  htmlAttrs: {
    lang: "en",
  },
  bodyAttrs: {
    class: "min-h-screen bg-background font-sans antialiased",
  },
});
</script>

<template>
  <div>
    <NuxtLoadingIndicator />
    <slot />
    <Toaster />
  </div>
</template>
