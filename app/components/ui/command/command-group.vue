<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { ListboxGroupProps } from "reka-ui";
import { useId } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed, onMounted, onUnmounted } from "vue";
import { provideCommandGroupContext, useCommand } from ".";

const props = defineProps<
  ListboxGroupProps & {
    class?: HTMLAttributes["class"];
    heading?: string;
  }
>();

const _delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { allGroups, filterState } = useCommand();
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const id = useId();

const _isRender = computed(() =>
  filterState.search ? filterState.filtered.groups.has(id) : true
);

provideCommandGroupContext({ id });
onMounted(() => {
  if (!allGroups.value.has(id)) allGroups.value.set(id, new Set());
});
onUnmounted(() => {
  allGroups.value.delete(id);
});
</script>

<template>
  <ListboxGroup
    v-bind="delegatedProps"
    :id="id"
    data-slot="command-group"
    :class="cn('text-foreground overflow-hidden p-1', props.class)"
    :hidden="isRender ? undefined : true"
  >
    <ListboxGroupLabel v-if="heading" data-slot="command-group-heading" class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
      {{ heading }}
    </ListboxGroupLabel>
    <slot />
  </ListboxGroup>
</template>
