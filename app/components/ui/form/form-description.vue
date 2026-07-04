<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { useFormField } from "./use-form-field";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { formDescriptionId: _formDescriptionId } = useFormField();
</script>

<template>
  <p
    :id="_formDescriptionId"
    data-slot="form-description"
    :class="cn('text-sm text-muted-foreground', props.class)"
  >
    <slot />
  </p>
</template>
