<script lang="ts" setup>
import type { StepperIndicatorProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaStepperIndicator, useForwardProps } from "reka-ui";

const props = defineProps<StepperIndicatorProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <RekaStepperIndicator
    v-slot="slotProps"
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/50',
        // Disabled
        'group-data-[disabled]:text-muted-foreground group-data-[disabled]:opacity-50',
        // Active
        'group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground',
        // Completed
        'group-data-[state=completed]:bg-accent group-data-[state=completed]:text-accent-foreground',
        props.class,
      )
    "
  >
    <slot v-bind="slotProps" />
  </RekaStepperIndicator>
</template>
