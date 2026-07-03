<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { TagsInputItemProps } from "reka-ui";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  TagsInputItemProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <TagsInputItem v-bind="forwardedProps" :class="cn('flex h-5 items-center rounded-md bg-secondary data-[state=active]:ring-ring data-[state=active]:ring-2 data-[state=active]:ring-offset-2 ring-offset-background', props.class)">
    <slot />
  </TagsInputItem>
</template>
