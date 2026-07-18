<script setup lang="ts">
import { Switch } from "~/components/ui/switch";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const colorMode = useColorMode();

const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (value: boolean) => {
    colorMode.preference = value ? "dark" : "light";
  },
});

const settingsItems = [
  { label: "General", icon: "hugeicons:settings-02", to: "settings/general" },
  { label: "Profile", icon: "hugeicons:user-circle", to: "settings/profile" },
  { label: "Security", icon: "hugeicons:shield-01", to: "settings/security" },
];

function openWhatsNew() {
  // TODO: open What's New modal/sheet
}

function openDonate() {
  // TODO: open Donate modal/sheet
}
</script>

<template>
  <div class="mt-4 space-y-2">
    <h3 class="font-ibm-plex-mono text-xs uppercase">Settings</h3>
    <div class="space-y-1">
      <NuxtLink
        v-for="item in settingsItems"
        :key="item.label"
        v-slot="{ isActive, href, navigate }"
        :to="`/workspace/${workspaceId}/${item.to}`"
        custom
      >
        <a
          :href="href"
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          :class="[isActive && 'bg-[#f2f2f2] dark:bg-neutral-800']"
          @click="navigate"
        >
          <Icon :name="item.icon" size="18" />
          <p class="text-sm">{{ item.label }}</p>
        </a>
      </NuxtLink>
    </div>
  </div>

  <div class="mt-4 space-y-2">
    <h3 class="font-ibm-plex-mono text-xs uppercase">System</h3>
    <div class="space-y-1">
      <div
        class="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <div class="flex items-center space-x-2">
          <Icon :name="isDark ? 'hugeicons:moon-02' : 'hugeicons:sun-03'" size="18" />
          <p class="text-sm">Dark Mode</p>
        </div>
        <Switch v-model="isDark" />
      </div>

      <button
        type="button"
        class="flex w-full cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        @click="openWhatsNew"
      >
        <Icon name="hugeicons:sparkles" size="18" />
        <p class="text-sm">What's New</p>
      </button>

      <NuxtLink
        v-slot="{ isActive, href, navigate }"
        :to="`/workspace/${workspaceId}/support`"
        custom
      >
        <a
          :href="href"
          class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
          :class="[isActive && 'bg-[#f2f2f2] dark:bg-neutral-800']"
          @click="navigate"
        >
          <Icon name="hugeicons:help-circle" size="18" />
          <p class="text-sm">Help & Support</p>
        </a>
      </NuxtLink>

      <button
        type="button"
        class="flex w-full cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
        @click="openDonate"
      >
        <Icon name="hugeicons:favourite" size="18" />
        <p class="text-sm">Donate</p>
      </button>
    </div>
  </div>
</template>
