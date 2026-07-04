import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
);

export type FieldVariants = VariantProps<typeof fieldVariants>;

export { default as Field } from "./field.vue";
export { default as FieldContent } from "./field-content.vue";
export { default as FieldDescription } from "./field-description.vue";
export { default as FieldError } from "./field-error.vue";
export { default as FieldGroup } from "./field-group.vue";
export { default as FieldLabel } from "./field-label.vue";
export { default as FieldLegend } from "./field-legend.vue";
export { default as FieldSeparator } from "./field-separator.vue";
export { default as FieldSet } from "./field-set.vue";
export { default as FieldTitle } from "./field-title.vue";
