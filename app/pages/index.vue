<script setup lang="ts">
import Hero from "~/components/hero-section.vue";
const { loggedIn } = useUserSession();

watch(
  () => loggedIn.value,
  (loggedIn) => {
    if (loggedIn) {
      // eslint-disable-next-line link-checker/valid-route, link-checker/valid-sitemap-link
      navigateTo("/workspace/onboarding");
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <div>
    <Hero />
  </div>
</template>
