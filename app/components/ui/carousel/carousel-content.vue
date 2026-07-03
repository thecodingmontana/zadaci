<script setup lang="ts">
import type { WithClassAsProps } from "./interface";
import { useCarousel } from "./use-carousel";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<WithClassAsProps>();

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
