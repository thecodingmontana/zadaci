<script setup lang="ts">
import type { ButtonVariants } from "@/components/ui/button";
import type { WithClassAsProps } from "./interface";
import { useCarousel } from "./use-carousel";

const _props = withDefaults(
  defineProps<
    {
      variant?: ButtonVariants["variant"];
      size?: ButtonVariants["size"];
    } & WithClassAsProps
  >(),
  {
    variant: "outline",
    size: "icon",
  }
);

const {
  orientation: _orientation,
  canScrollPrev: _canScrollPrev,
  scrollPrev: _scrollPrev,
  // biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
} = useCarousel();
</script>

<template>
  <Button
    data-slot="carousel-previous"
    :disabled="!_canScrollPrev"
    :class="cn(
      'absolute size-8 rounded-full',
      _orientation === 'horizontal'
        ? 'top-1/2 -left-12 -translate-y-1/2'
        : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
      props.class,
    )"
    :variant="variant"
    :size="size"
    @click="_scrollPrev"
  >
    <slot>
      <ArrowLeft />
      <span class="sr-only">Previous Slide</span>
    </slot>
  </Button>
</template>
