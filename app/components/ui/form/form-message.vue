<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { useFormField } from "./use-form-field";

const _props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { name: _name, formMessageId: _formMessageId } = useFormField();
</script>

<template>
  <ErrorMessage
    :id="_formMessageId"
    data-slot="form-message"
    as="p"
    :name="toValue(_name)"
    :class="cn('text-destructive text-sm', props.class)"
  />
</template>
