<script setup lang="ts">
import { Switch } from "~/components/ui/switch";

const colorMode = useColorMode();

const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (value: boolean) => {
    colorMode.preference = value ? "dark" : "light";
  },
});

const settingsItems = [
  { label: "General", icon: "hugeicons:settings-02" },
  { label: "Profile", icon: "hugeicons:user-circle" },
  { label: "Security", icon: "hugeicons:shield-01" },
];
</script>

<template>
  <div class="mt-4 space-y-2">
    <h3 class="font-ibm-plex-mono text-xs uppercase">Settings</h3>
    <div class="space-y-1">
      <div
        v-for="item in settingsItems"
        :key="item.label"
        class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <Icon :name="item.icon" size="18" />
        <p class="text-sm">{{ item.label }}</p>
      </div>
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

      <div
        class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <Icon name="hugeicons:sparkles" size="18" />
        <p class="text-sm">What's New</p>
      </div>

      <div
        class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <Icon name="hugeicons:help-circle" size="18" />
        <p class="text-sm">Help & Support</p>
      </div>

      <div
        class="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
      >
        <Icon name="hugeicons:favourite" size="18" />
        <p class="text-sm">Donate</p>
      </div>
    </div>
  </div>
</template>
