<script setup lang="ts">
import { Bell } from "@lucide/vue";
import { motion } from "motion-v";
import { ref } from "vue";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

const notifications = ref([
  {
    id: 1,
    title: "Engagement spike detected",
    body: "Your latest newsletter had a 45% increase in opens.",
    unread: true,
  },
  {
    id: 2,
    title: "Campaign sent",
    body: "Your latest newsletter saw a 45% rise in opens.",
    unread: true,
  },
  {
    id: 3,
    title: "Campaign scheduled",
    body: "Product launch campaign tomorrow at 2 PM.",
    unread: false,
  },
]);

const hasUnread = ref(true);
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative size-9">
        <Bell class="size-4" />
        <motion.span
          v-if="hasUnread"
          :initial="{ scale: 0 }"
          :animate="{ scale: 1 }"
          :transition="{ type: 'spring', stiffness: 400, damping: 15 }"
          class="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive"
        />
      </Button>
    </PopoverTrigger>

    <PopoverContent align="end" class="w-80 p-0">
      <motion.div
        :initial="{ opacity: 0, y: -4 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.15 }"
      >
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <span class="text-sm font-semibold">Notifications</span>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs">Mark all read</Button>
        </div>

        <ul class="max-h-80 overflow-y-auto">
          <li
            v-for="n in notifications"
            :key="n.id"
            class="flex gap-2 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-accent"
          >
            <span
              class="mt-1.5 size-1.5 shrink-0 rounded-full"
              :class="n.unread ? 'bg-primary' : 'bg-transparent'"
            />
            <div class="space-y-0.5">
              <p class="text-sm leading-none font-medium">{{ n.title }}</p>
              <p class="text-xs text-muted-foreground">{{ n.body }}</p>
            </div>
          </li>
        </ul>
      </motion.div>
    </PopoverContent>
  </Popover>
</template>
