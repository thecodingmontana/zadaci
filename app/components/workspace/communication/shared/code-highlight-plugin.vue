<script setup lang="ts">
import { registerCodeHighlighting, ShikiTokenizer } from "@lexical/code-shiki";
import { useLexicalComposer } from "lexical-vue/LexicalComposer";

const props = withDefaults(defineProps<{ enabled?: boolean }>(), { enabled: true });

const customTokenizer = {
  ...ShikiTokenizer,
  defaultTheme: "vitesse-light",
};

const editor = useLexicalComposer();
let unregister: (() => void) | null = null;

function register() {
  if (unregister) return;
  unregister = registerCodeHighlighting(editor, customTokenizer);
}
function teardown() {
  unregister?.();
  unregister = null;
}

onMounted(() => {
  if (props.enabled) register();
});
watch(
  () => props.enabled,
  (on) => (on ? register() : teardown()),
);
onUnmounted(teardown);
</script>
<template><div /></template>
