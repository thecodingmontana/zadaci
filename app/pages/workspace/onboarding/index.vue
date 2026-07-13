<script setup lang="ts">
import { RotateCw, ServerCrash } from "@lucide/vue";
import { AnimatePresence, motion } from "motion-v";
import OnboardingLoader from "~/components/svgs/onboarding-loader.vue";
import OnboardingWrapper from "~/components/workspace/onboarding/onboarding-wrapper.vue";
import { useOnboardingDetails } from "~/composables/use-onboarding-details";
import { ONBOARDING_LOADER_CYCLE_MS } from "~/constants/onboarding";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

definePageMeta({
  middleware: ["authenticated"],
  layout: "onboarding",
});
useHead({
  titleTemplate: "%s - Zadaci",
});
defineOgImage("Zadaci", {
  title: "Zadaci - Onboarding",
  description:
    "All-in-one project management platform built to help you and your team get things done faster",
});

const workspaceStore = useWorkspaceStore();

const { data: onboarding, error, status, refetch: refresh } = useOnboardingDetails();

const isRedirecting = ref(false);

const hasCheckedInitialOnboarding = ref(false);

watch(
  status,
  async (val) => {
    if (val !== "success" || hasCheckedInitialOnboarding.value) return;
    hasCheckedInitialOnboarding.value = true;

    const details = onboarding.value;

    if (import.meta.dev) {
      console.warn("[onboarding] initial redirect check", {
        username: details?.username,
        hasWorkspace: Boolean(details?.workspace),
      });
    }

    if (details?.username && details.workspace) {
      isRedirecting.value = true;
      workspaceStore.onSetActiveWorkspace(details.workspace);
      await navigateTo(`/workspace/${details.workspace.id}/dashboard`);
    }
  },
  { immediate: true },
);

const loaderStartedAt = ref<number | null>(null);
const showLoader = ref(false);

watch(
  status,
  (val) => {
    if (val === "pending") {
      if (!showLoader.value) {
        loaderStartedAt.value = Date.now();
      }
      showLoader.value = true;
      return;
    }

    if (!loaderStartedAt.value) {
      showLoader.value = false;
      return;
    }

    const elapsed = Date.now() - loaderStartedAt.value;
    const remainderIntoCycle = elapsed % ONBOARDING_LOADER_CYCLE_MS;
    const remaining =
      remainderIntoCycle === 0 ? 0 : ONBOARDING_LOADER_CYCLE_MS - remainderIntoCycle;

    setTimeout(() => {
      showLoader.value = false;
    }, remaining);
  },
  { immediate: true },
);

function errorMessage() {
  return (
    error.value?.data?.message ??
    error.value?.data?.statusMessage ??
    error.value?.message ??
    "Something went wrong. Please try again."
  );
}
</script>

<template>
  <div>
    <AnimatePresence>
      <motion.div
        v-if="showLoader || isRedirecting"
        key="loader"
        class="grid min-h-screen place-content-center"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0, transition: { duration: 0.25 } }"
      >
        <div class="flex flex-col items-center gap-3">
          <OnboardingLoader class="size-24" />
        </div>
      </motion.div>
    </AnimatePresence>

    <div
      v-if="!showLoader && !isRedirecting && status === 'error'"
      class="grid min-h-screen place-content-center"
    >
      <div class="flex flex-col items-center gap-3">
        <ServerCrash class="size-20 text-destructive" />
        <div class="text-center">
          <p class="text-base font-medium text-destructive">Internal Server Error.</p>
          <p class="text-sm text-destructive">{{ errorMessage() }}</p>
        </div>
        <button
          type="button"
          class="mt-1 inline-flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          @click="refresh()"
        >
          <RotateCw class="size-3.5" />
          Try again
        </button>
      </div>
    </div>

    <OnboardingWrapper
      v-if="!showLoader && !isRedirecting && status !== 'error'"
      :username="onboarding?.username ?? null"
      :workspace="onboarding?.workspace ?? null"
      :profile-completed="onboarding?.profile_completed ?? false"
    />
  </div>
</template>
