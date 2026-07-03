<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { useFormField } from "./use-form-field";

const _props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { formDescriptionId: _formDescriptionId } = useFormField();
</script>

<template>
  <p
    :id="_formDescriptionId"
    data-slot="form-description"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </p>
</template>
