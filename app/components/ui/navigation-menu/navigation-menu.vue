<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { NavigationMenuRootEmits, NavigationMenuRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<
    NavigationMenuRootProps & {
      class?: HTMLAttributes["class"];
      viewport?: boolean;
    }
  >(),
  {
    viewport: true,
  }
);
const emits = defineEmits<NavigationMenuRootEmits>();

const delegatedProps = reactiveOmit(props, "class", "viewport");
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <NavigationMenuRoot
    v-slot="slotProps"
    data-slot="navigation-menu"
    :data-viewport="viewport"
    v-bind="forwarded"
    :class="cn('group/navigation-menu relative flex max-w-max flex-1 items-center justify-center', props.class)"
  >
    <slot v-bind="slotProps" />
    <NavigationMenuViewport v-if="viewport" />
  </NavigationMenuRoot>
</template>
