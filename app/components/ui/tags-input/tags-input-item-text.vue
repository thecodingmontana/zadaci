<script setup lang="ts">
import type { TagsInputItemTextProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaTagsInputItemText, useForwardProps } from "reka-ui";

const props = defineProps<TagsInputItemTextProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RekaTagsInputItemText
    v-bind="forwardedProps"
    :class="cn('rounded bg-transparent px-2 py-0.5 text-sm', props.class)"
  >
    <slot />
  </RekaTagsInputItemText>
</template>
