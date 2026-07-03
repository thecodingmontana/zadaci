<script lang="ts" setup>
import type { LabelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { useFormField } from "./use-form-field";

const _props = defineProps<LabelProps & { class?: HTMLAttributes["class"] }>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { error: _error, formItemId: _formItemId } = useFormField();
</script>

<template>
  <Label
    data-slot="form-label"
    :data-error="!!_error"
    :class="cn(
      'data-[error=true]:text-destructive',
      props.class,
    )"
    :for="_formItemId"
  >
    <slot />
  </Label>
</template>
