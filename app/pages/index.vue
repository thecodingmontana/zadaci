<script setup lang="ts">
import Hero from "~/components/hero-section.vue";
const { loggedIn } = useUserSession();

useSeoMeta({
  title: "Collaborative Task Management Platform",
  description:
    "Zadaci is a powerful and collaborative task management platform designed for modern teams. Organize projects, manage tasks, and stay in sync.",
});

defineOgImage("Zadaci", {
  title: "Collaborative Task Management",
  description: "Organize projects, manage tasks, and stay in sync with your team.",
});

useSchemaOrg([
  defineWebPage(),
  defineBreadcrumb({
    itemListElement: [{ name: "Home", item: "/" }],
  }),
]);

watch(
  () => loggedIn.value,
  (loggedIn) => {
    if (loggedIn) {
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
