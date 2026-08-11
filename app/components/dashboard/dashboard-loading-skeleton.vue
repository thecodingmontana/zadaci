<script setup lang="ts">
import { Skeleton } from "~/components/ui/skeleton";
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-2">
        <Skeleton class="h-7 w-64" />
        <Skeleton class="h-4 w-44" />
      </div>
      <div class="flex items-center gap-2">
        <Skeleton class="h-9 w-64 rounded-lg" />
        <Skeleton class="h-9 w-28 rounded-lg" />
      </div>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Skeleton v-for="i in 5" :key="i" class="h-24 rounded-xl" />
    </div>

    <!-- Contribution grid -->
    <Skeleton class="h-36 rounded-xl" />

    <!-- Productivity + project overview -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Skeleton class="h-96 rounded-xl xl:col-span-2" />
      <Skeleton class="h-96 rounded-xl" />
    </div>

    <!-- Donut stats -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Skeleton class="h-80 rounded-xl" />
      <Skeleton class="h-80 rounded-xl" />
    </div>

    <!-- Recent tasks -->
    <Skeleton class="h-72 rounded-xl" />
  </div>
</template>
