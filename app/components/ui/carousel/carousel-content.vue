<script setup lang="ts">
import type { WithClassAsProps } from "./interface";
import { useCarousel } from "./use-carousel";

defineOptions({
  inheritAttrs: false,
});

const _props = defineProps<WithClassAsProps>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { carouselRef: _carouselRef, orientation: _orientation } = useCarousel();
</script>

<template>
  <div
    :ref="_carouselRef"
    data-slot="carousel-content"
    class="overflow-hidden"
  >
    <div
      :class="
        cn(
          'flex',
          _orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
          props.class,
        )"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </div>
</template>
