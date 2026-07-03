<script lang="ts" setup>
import type { LabelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { useFormField } from "./use-form-field";

const props = defineProps<LabelProps & { class?: HTMLAttributes["class"] }>();

const { error, formItemId: _formItemId } = useFormField();
</script>

<template>
  <Label
    data-slot="form-label"
    :data-error="!!error"
    :class="cn(
      'data-[error=true]:text-destructive',
      props.class,
    )"
    :for="_formItemId"
  >
    <slot />
  </Label>
</template>
