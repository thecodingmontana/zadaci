<script setup lang="ts">
import { motion } from "motion-v";
import { Button } from "~/components/ui/button";
import { BlueprintFrame } from "./ui/blueprint-frame";
import { MultiplayerText } from "./ui/multiplayer-text";
</script>

<template>
  <section
    class="relative flex min-h-[calc(100dvh)] w-full flex-col items-center justify-center overflow-hidden border border-black/8 bg-[#fafafa] px-6 py-20 text-center dark:border-white/10 dark:bg-[#08080a]"
  >
    <BlueprintFrame class="dark:hidden" color="#0a0a0a" :inset="40" />
    <BlueprintFrame class="hidden dark:block" :inset="40" />

    <div class="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 px-4">
      <MultiplayerText
        text="Turning teams productivity into a powerful daily habit"
        class="text-3xl leading-[1.45] font-semibold tracking-tight text-black sm:text-[3.5rem] dark:text-white"
        :players="[
          { name: 'Olive Bishop', color: '#3ecf8e' },
          { name: 'Blackie', color: '#f0883e' },
          { name: 'thecodingmontana', color: '#22d3ee' },
          { name: 'Ebra Kitavey', color: '#ffb703' },
        ]"
        :interval="1500"
      />

      <p
        class="max-w-xl text-sm leading-relaxed text-balance text-black/60 sm:text-lg dark:text-white/50"
      >
        Stay organized and collaborate seamlessly with Zadaci. The all-in-one project management
        platform built to get things done faster.
      </p>
      <motion.div :while-hover="{ scale: 1.05 }" :while-tap="{ scale: 0.95 }">
        <NuxtLink to="/auth/signup">
          <Button
            class="hover:bg-primary-secondary group inline-flex h-max w-full cursor-pointer items-center justify-center gap-x-2 rounded-full border border-transparent bg-brand px-4 py-2.5 text-base font-medium text-white shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(249,129,99,1)_inset,0rem_0rem_0rem_0.0625rem_#F97452_inset,0rem_0.03125rem_0rem_0.09375rem_#F97452_inset] transition-colors hover:shadow-[0rem_-0.0625rem_0rem_0.0625rem_rgba(252,199,185,0.8)_inset,0rem_0rem_0rem_0.0625rem_#F97452_inset,0rem_0.03125rem_0rem_0.09375rem_hsla(0,0%,100%,0.25)_inset] focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:shadow-xs disabled:hover:shadow-xs"
          >
            Get Started
            <div
              class="size-6 overflow-hidden rounded-full border border-white/10 bg-white/5 duration-500 group-hover:bg-white/10"
            >
              <div
                class="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0"
              >
                <span class="flex size-6">
                  <Icon name="lucide-arrow-right" class="m-auto size-3.5" />
                </span>
                <span class="flex size-6">
                  <Icon name="lucide-arrow-right" class="m-auto size-3.5" />
                </span>
              </div>
            </div>
          </Button>
        </NuxtLink>
      </motion.div>
    </div>
  </section>
</template>
