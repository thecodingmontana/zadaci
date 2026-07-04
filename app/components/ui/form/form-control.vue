<script lang="ts" setup>
import { useFormField } from "./use-form-field";

const {
  error: _error,
  formItemId: _formItemId,
  formDescriptionId: _formDescriptionId,
  formMessageId: _formMessageId,
} = useFormField();
</script>

<template>
  <Slot
    :id="_formItemId"
    data-slot="form-control"
    :aria-describedby="
      !_error ? `${_formDescriptionId}` : `${_formDescriptionId} ${_formMessageId}`
    "
    :aria-invalid="!!_error"
  >
    <slot />
  </Slot>
</template>
