<script setup lang="ts">
import { useId } from "reka-ui";
import { computed, toRefs } from "vue";
import { provideChartContext } from ".";

const props = defineProps<{
  id?: HTMLAttributes["id"];
  class?: HTMLAttributes["class"];
  config: ChartConfig;
  cursor?: boolean;
}>();

defineSlots<{
  default: {
    id: string;
    config: ChartConfig;
  };
}>();

const { config: _config } = toRefs(props);
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const uniqueId = useId();
const _chartId = computed(
  () => `chart-${props.id || uniqueId.replace(/:/g, "")}`
);

provideChartContext({
  id: uniqueId,
  config: _config,
});
</script>

<template>
  <div
    data-slot="chart"
    :data-chart="_chartId"
    :class="cn(
      `[&_.tick_text]:!fill-muted-foreground [&_.tick_line]:!stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex flex-col aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden [&_[data-vis-xy-container]]:h-full [&_[data-vis-single-container]]:h-full h-full [&_[data-vis-xy-container]]:w-full [&_[data-vis-single-container]]:w-full w-full `,
      props.class,
    )"
    :style="{
      '--vis-tooltip-padding': '0px',
      '--vis-tooltip-background-color': 'transparent',
      '--vis-tooltip-border-color': 'transparent',
      '--vis-tooltip-text-color': 'none',
      '--vis-tooltip-shadow-color': 'none',
      '--vis-tooltip-backdrop-filter': 'none',
      '--vis-crosshair-circle-stroke-color': '#0000',
      '--vis-crosshair-line-stroke-width': cursor ? '1px' : '0px',
      '--vis-font-family': 'var(--font-sans)',
    }"
  >
    <slot :id="uniqueId" :config="_config" />
    <ChartStyle :id="_chartId" />
  </div>
</template>
