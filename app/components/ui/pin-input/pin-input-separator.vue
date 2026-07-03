<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import { useForwardProps } from "reka-ui";

const props = defineProps<PrimitiveProps>();
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(props);
</script>

<template>
  <Primitive
    data-slot="pin-input-separator"
    v-bind="forwardedProps"
  >
    <slot>
      <Minus />
    </slot>
  </Primitive>
</template>
