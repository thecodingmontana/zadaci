<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { useFormField } from "./use-form-field";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { name, formMessageId: _formMessageId } = useFormField();
</script>

<template>
  <ErrorMessage
    :id="_formMessageId"
    data-slot="form-message"
    as="p"
    :name="toValue(name)"
    :class="cn('text-sm text-destructive', props.class)"
  />
</template>
