<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type {
  MenubarCheckboxItemEmits,
  MenubarCheckboxItemProps,
} from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  MenubarCheckboxItemProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<MenubarCheckboxItemEmits>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <MenubarCheckboxItem
    data-slot="menubar-checkbox-item"
    v-bind="forwarded"
    :class="cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
      props.class,
    )"
  >
    <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <MenubarItemIndicator>
        <slot name="indicator-icon">
          <Check class="size-4" />
        </slot>
      </MenubarItemIndicator>
    </span>
    <slot />
  </MenubarCheckboxItem>
</template>
