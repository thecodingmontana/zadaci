<script setup lang="ts">
import DevBanner from "~/components/shared/dev-banner.vue";
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
  <main>
    <NuxtLoadingIndicator />
    <DevBanner />
    <slot />
    <Toaster />
  </main>
</template>
