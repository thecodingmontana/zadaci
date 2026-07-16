<script setup lang="ts">
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";
import { cn } from "~/lib/utils";

const props = defineProps<{
  id: string;
  imageUrl: string;
  name: string;
}>();

const { params } = useRoute();
</script>

<template>
  <ActionTooltip :label="props.name">
    <NuxtLink
      :to="`/workspace/${props.id}/dashboard`"
      class="group relative flex cursor-pointer items-center"
    >
      <div
        :class="
          cn(
            'absolute left-0 w-1 rounded-r-full bg-brand transition-all',
            params?.workspaceId !== id && 'group-hover:h-5',
            params?.workspaceId === id && 'h-9',
          )
        "
      />
      <div
        :class="
          cn(
            'group relative mx-3 flex size-12 overflow-hidden rounded-3xl transition-all group-hover:rounded-2xl',
            params?.workspaceId === id && 'rounded-2xl bg-primary/10 text-primary',
          )
        "
      >
        <NuxtImg fill :src="props.imageUrl" alt="channel" />
      </div>
    </NuxtLink>
  </ActionTooltip>
</template>
