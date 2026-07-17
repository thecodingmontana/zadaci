<script setup lang="ts">
import DevBanner from "~/components/shared/dev-banner.vue";
import Toaster from "~/components/toast/toaster.vue";
import ModalProviders from "~/providers//onboarding-provider.vue";

useHead({
  htmlAttrs: {
    lang: "en",
  },
  bodyAttrs: {
    class: "min-h-screen bg-background font-sans antialiased",
  },
  titleTemplate: "%s - Zadaci",
});
</script>

<template>
  <main class="max-w-8xl relative mx-auto flex min-h-screen flex-col overflow-hidden">
    <NuxtLoadingIndicator />
    <DevBanner />
    <slot />
    <Toaster />
    <ModalProviders />
  </main>
</template>
