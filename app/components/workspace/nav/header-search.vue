<script setup lang="ts">
import { Search } from "@lucide/vue";
import { Input } from "~/components/ui/input";
</script>

<template>
  <div class="relative hidden sm:block">
    <Search
      class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <Input type="search" placeholder="Search..." class="h-9 w-48 pl-8 lg:w-64" />
  </div>
</template>
