<script setup lang="ts">
import type { WithClassAsProps } from "./interface";
import { useCarousel } from "./use-carousel";

const _props = defineProps<WithClassAsProps>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { orientation: _orientation } = useCarousel();
</script>

<template>
  <div
    data-slot="carousel-item"
    role="group"
    aria-roledescription="slide"
    :class="cn(
      'min-w-0 shrink-0 grow-0 basis-full',
      _orientation === 'horizontal' ? 'pl-4' : 'pt-4',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
