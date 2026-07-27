import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export const createWorkspaceSchema = toTypedSchema(
  z.object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must not exceed 100 characters")
      .regex(/^[a-z\s'-]+$/i, "Name can only contain letters, spaces, hyphens, and apostrophes")
      .transform((name) => name.trim()),
    image: z.string().optional(),
  }),
);

export const deleteWorkspaceSchema = toTypedSchema(
  z.object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must not exceed 100 characters")
      .regex(/^[a-z\s'-]+$/i, "Name can only contain letters, spaces, hyphens, and apostrophes")
      .transform((name) => name.trim()),
  }),
);

export const setupPasswordSchema = toTypedSchema(
  z.object({
    password: z.string().min(8, "Password shouldn't be less than 8 characters"),
  }),
);

export const resetPasswordSchema = toTypedSchema(
  z.object({
    newPassword: z.string().min(8, "Password shouldn't be less than 8 characters"),
    password: z.string().min(8, "Password shouldn't be less than 8 characters"),
  }),
);

export const createChannelSchema = toTypedSchema(
  z.object({
    name: z
      .string()
      .min(1, "Channel name is required")
      .max(100, "Channel name must not exceed 100 characters")
      .regex(
        /^[a-z0-9\s-]+$/i,
        "Channel name can only contain letters, numbers, spaces, and hyphens",
      )
      .refine((val) => val.toLowerCase() !== "general", {
        message: "Channel name cannot be 'general'",
      })
      .transform((name) => name.trim()),
    type: z.enum(["public", "private"]),
  }),
);

export const editChannelSchema = toTypedSchema(
  z.object({
    name: z
      .string()
      .min(1, "Channel name is required")
      .max(100, "Channel name must not exceed 100 characters")
      .regex(
        /^[a-z0-9\s-]+$/i,
        "Channel name can only contain letters, numbers, spaces, and hyphens",
      )
      .refine((val) => val.toLowerCase() !== "general", {
        message: "Channel name cannot be 'general'",
      })
      .transform((name) => name.trim()),
    type: z.enum(["public", "private"]),
  }),
);
