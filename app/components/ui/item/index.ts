import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as ItemActions } from "./item-actions.vue";
export { default as ItemContent } from "./item-content.vue";
export { default as ItemDescription } from "./item-description.vue";
export { default as ItemFooter } from "./item-footer.vue";
export { default as ItemGroup } from "./item-group.vue";
export { default as ItemHeader } from "./item-header.vue";
export { default as ItemMedia } from "./item-media.vue";
export { default as ItemSeparator } from "./item-separator.vue";
export { default as ItemTitle } from "./item-title.vue";
export { default as Item } from "./item.vue";

export const itemVariants = cva(
  "group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border",
        muted: "bg-muted/50",
      },
      size: {
        default: "gap-4 p-4",
        sm: "gap-2.5 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
        image: "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type ItemVariants = VariantProps<typeof itemVariants>;
export type ItemMediaVariants = VariantProps<typeof itemMediaVariants>;
