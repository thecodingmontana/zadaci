import { onMounted, onUnmounted, ref } from "vue";

export function useReducedMotion() {
  const reduced = ref(false);
  let mq: MediaQueryList | null = null;
  const handler = () => {
    reduced.value = mq!.matches;
  };

  onMounted(() => {
    mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.value = mq.matches;
    mq.addEventListener("change", handler);
  });
  onUnmounted(() => mq?.removeEventListener("change", handler));

  return reduced;
}
