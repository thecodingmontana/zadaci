<script setup lang="ts">
import { motion } from "motion-v";
</script>

<template>
  <motion.footer
    :animate="{ opacity: 1, y: 0 }"
    :initial="{ opacity: 0, y: 30 }"
    :transition="{ delay: 0.6, ease: 'easeIn' }"
    class="container mx-auto flex flex-col items-center gap-y-3 px-6 py-5"
  >
    <p class="">© {{ new Date().getFullYear() }} Crow Studios. All rights reserved.</p>
  </motion.footer>
</template>
