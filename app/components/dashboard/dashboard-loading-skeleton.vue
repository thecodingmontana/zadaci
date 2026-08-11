<script setup lang="ts">
import { Skeleton } from "~/components/ui/skeleton";
</script>

<template>
  <div class="grid grid-cols-1 gap-10 md:grid-cols-4">
    <div class="col-span-1 flex flex-col gap-8 self-start md:col-span-2 xl:col-span-3">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center lg:items-center">
        <div class="space-y-2">
          <Skeleton class="h-7 w-64" />
          <Skeleton class="h-4 w-44" />
        </div>
        <Skeleton class="h-10 w-full rounded-md sm:w-28" />
      </div>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-md" />
      </div>

      <Skeleton class="h-96 w-full rounded-md" />
    </div>

    <div class="col-span-1 flex flex-col gap-8 self-start md:col-span-2 xl:col-span-1">
      <Skeleton class="h-[15rem] w-full rounded-md" />
      <Skeleton class="h-[15rem] w-full rounded-md" />
    </div>
  </div>
</template>
