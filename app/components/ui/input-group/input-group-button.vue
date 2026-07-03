<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import type { ButtonVariants } from "@/components/ui/button";
import type { InputGroupButtonVariants } from ".";

interface InputGroupButtonProps {
  class?: HTMLAttributes["class"];
  size?: InputGroupButtonVariants["size"];
  variant?: ButtonVariants["variant"];
}

const _props = withDefaults(defineProps<InputGroupButtonProps>(), {
  size: "xs",
  variant: "ghost",
});
</script>

<template>
  <Button
    :data-size="props.size"
    :variant="props.variant"
    :class="cn(inputGroupButtonVariants({ size: props.size }), props.class)"
  >
    <slot />
  </Button>
</template>
