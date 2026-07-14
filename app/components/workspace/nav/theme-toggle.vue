<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";
import { useColorMode } from "@vueuse/core";
import { motion } from "motion-v";
import { Button } from "~/components/ui/button";

const mode = useColorMode();

function toggle() {
  mode.value = mode.value === "dark" ? "light" : "dark";
}
</script>

<template>
  <Button variant="ghost" size="icon" class="size-9" @click="toggle">
    <motion.div
      :key="mode"
      :initial="{ rotate: -90, opacity: 0 }"
      :animate="{ rotate: 0, opacity: 1 }"
      :transition="{ duration: 0.2 }"
    >
      <Moon v-if="mode === 'light'" class="size-4" />
      <Sun v-else class="size-4" />
    </motion.div>
  </Button>
</template>
