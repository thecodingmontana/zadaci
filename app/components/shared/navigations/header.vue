<script setup lang="ts">
import { motion } from "motion-v";
import Zadaci from "~/components/svgs/zadaci.vue";
</script>

<template>
  <motion.header
    :initial="{
      opacity: 0,
      y: -10,
    }"
    :animate="{
      opacity: 1,
      y: 0,
    }"
    :transition="{
      duration: 0.5,
      ease: 'easeIn',
    }"
    class="sticky top-0 right-0 left-0 z-30 flex items-center justify-between px-2 py-3 backdrop-blur md:px-5 xl:px-10"
  >
    <NuxtLink to="/" class="flex items-center gap-2">
      <Zadaci class="h-auto w-9" />
      <h1 class="mt-1 font-bebas-neue text-[2rem] font-semibold">Zadaci</h1>
    </NuxtLink>
    <NuxtLink to="/auth/signup">
      <Button
        class="hover:bg-primary-secondary group inline-flex h-max w-full cursor-pointer items-center justify-center rounded-lg border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(249,129,99,1)_inset,0rem_0rem_0rem_0.0625rem_#F97452_inset,0rem_0.03125rem_0rem_0.09375rem_#F97452_inset] transition-colors duration-300 ease-in-out hover:translate-y-0.5 hover:shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(252,199,185,0.8)_inset,0rem_0rem_0rem_0.0625rem_#F97452_inset,0rem_0.03125rem_0rem_0.09375rem_hsla(0,0%,100%,0.25)_inset] focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:shadow-xs disabled:hover:shadow-xs"
      >
        Get started
        <Icon
          name="lucide-arrow-right"
          class="-rotate-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          size="15"
        />
      </Button>
    </NuxtLink>
  </motion.header>
</template>
