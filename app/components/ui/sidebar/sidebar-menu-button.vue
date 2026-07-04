<script setup lang="ts">
import type { Component } from "vue";
import type { SidebarMenuButtonProps } from "./sidebar-menu-button-child.vue";
import { reactiveOmit } from "@vueuse/core";
import { useSidebar } from "./utils";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<
    SidebarMenuButtonProps & {
      tooltip?: string | Component;
    }
  >(),
  {
    as: "button",
    variant: "default",
    size: "default",
  },
);

const { isMobile: _isMobile, state: _state } = useSidebar();

const delegatedProps = reactiveOmit(props, "tooltip");
</script>

<template>
  <SidebarMenuButtonChild v-if="!tooltip" v-bind="{ ...delegatedProps, ...$attrs }">
    <slot />
  </SidebarMenuButtonChild>

  <Tooltip v-else>
    <TooltipTrigger as-child>
      <SidebarMenuButtonChild v-bind="{ ...delegatedProps, ...$attrs }">
        <slot />
      </SidebarMenuButtonChild>
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="_state !== 'collapsed' || _isMobile">
      <template v-if="typeof tooltip === 'string'">
        {{ tooltip }}
      </template>
      <component :is="tooltip" v-else />
    </TooltipContent>
  </Tooltip>
</template>
