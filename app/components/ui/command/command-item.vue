<script setup lang="ts">
import { reactiveOmit, useCurrentElement } from "@vueuse/core";
import type { ListboxItemEmits, ListboxItemProps } from "reka-ui";
import { useForwardPropsEmits, useId } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useCommand, useCommandGroup } from ".";

const props = defineProps<
  ListboxItemProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<ListboxItemEmits>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(delegatedProps, emits);

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const id = useId();
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const { filterState, allItems, allGroups } = useCommand();
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const groupContext = useCommandGroup();

const _isRender = computed(() => {
  if (filterState.search) {
    const filteredCurrentItem = filterState.filtered.items.get(id);
    // If the filtered items is undefined means not in the all times map yet
    // Do the first render to add into the map
    if (filteredCurrentItem === undefined) {
      return true;
    }

    // Check with filter
    return filteredCurrentItem > 0;
  }
  return true;
});

const itemRef = ref();
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const currentElement = useCurrentElement(itemRef);
onMounted(() => {
  if (!(currentElement.value instanceof HTMLElement)) return;

  // textValue to perform filter
  allItems.value.set(
    id,
    currentElement.value.textContent ?? props.value?.toString() ?? ""
  );

  const groupId = groupContext?.id;
  if (groupId) {
    if (allGroups.value.has(groupId)) {
      allGroups.value.get(groupId)?.add(id);
    } else {
      allGroups.value.set(groupId, new Set([id]));
    }
  }
});
onUnmounted(() => {
  allItems.value.delete(id);
});
</script>

<template>
  <ListboxItem
    v-if="isRender"
    v-bind="forwarded"
    :id="id"
    ref="itemRef"
    data-slot="command-item"
    :class="cn('data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*=\'text-\'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4', props.class)"
    @select="() => {
      filterState.search = ''
    }"
  >
    <slot />
  </ListboxItem>
</template>
