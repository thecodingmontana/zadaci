<script lang="ts" setup>
import { useId } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { provide } from "vue";
import { FORM_ITEM_INJECTION_KEY } from "./injection-keys";

const _props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const id = useId();
provide(FORM_ITEM_INJECTION_KEY, id);
</script>

<template>
  <div
    data-slot="form-item"
    :class="cn('grid gap-2', props.class)"
  >
    <slot />
  </div>
</template>
