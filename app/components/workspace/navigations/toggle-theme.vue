<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

withDefaults(
  defineProps<{
    side?: "right" | "top" | "bottom" | "left";
  }>(),
  {
    side: "right",
  },
);

const colorMode = useColorMode();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger class="w-full">
      <Button
        variant="ghost"
        size="icon"
        class="mt-1 w-full cursor-pointer justify-start rounded-md p-2 text-base font-normal hover:bg-[#f1f1f1] dark:hover:bg-[#343434]"
      >
        <Sun class="size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon
          class="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
        />
        <span>Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg dark:bg-[#1d1d1d]"
      :side="side"
      :align="side === 'top' || side === 'bottom' ? 'start' : 'end'"
      :side-offset="side === 'top' || side === 'bottom' ? 0 : 6"
    >
      <DropdownMenuItem
        class="cursor-pointer dark:hover:bg-[#343434]"
        @click="colorMode.preference = 'light'"
      >
        Light
      </DropdownMenuItem>
      <DropdownMenuItem
        class="cursor-pointer dark:hover:bg-[#343434]"
        @click="colorMode.preference = 'dark'"
      >
        Dark
      </DropdownMenuItem>
      <DropdownMenuItem
        class="cursor-pointer dark:hover:bg-[#343434]"
        @click="colorMode.preference = 'system'"
      >
        System
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
