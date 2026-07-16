<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

const props = withDefaults(
    defineProps<{
        label: string;
        side?: "top" | "right" | "bottom" | "left";
        align?: "start" | "center" | "end";
    }>(),
    {
        side: "right",
        align: "center",
    },
);
</script>

<template>
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger as-child>
                <slot />
            </TooltipTrigger>
            <TooltipContent :side="props.side" :align="props.align">
                <p className="font-semibold text-sm capitalize">
                    {{ props.label.toLowerCase() }}
                </p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>
