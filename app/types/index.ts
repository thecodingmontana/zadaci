import { QuestionMarkCircledIcon } from "@radix-icons/vue";
import { toTypedSchema } from "@vee-validate/zod";
import { h, ref } from "vue";
import * as z from "zod";

export type {
  ChangeTeammateRole,
  DBProject,
  DueItem,
  IAuthProvider,
  IDBProject,
  IOauth,
  IProject,
  IProjectColumn,
  MFAPasskey,
  ModalData,
  ModalStore,
  ModalType,
  MyTask,
  OauthStore,
  Priority,
  Project,
  ProjectMembers,
  Status,
  Task,
  Teammate,
  TeammatesWithProfile,
  TechStack,
  User,
  UserRole,
  Workspace,
  WorkspaceBreadcrumb,
  WorkspaceInvite,
  WorkspaceStore,
} from "~~/shared/types";

export {
  appLink,
  priorityOptions,
  validPriorities,
  validStatuses,
  weekDays,
} from "~~/shared/types";

export const emailSchema = z
  .email({
    message: "Invalid email!",
  })
  .toLowerCase()
  .refine(
    (email) => {
      // Reject emails with consecutive dots
      return !email.includes("..");
    },
    { message: "Email cannot contain consecutive dots" },
  )
  .refine(
    (email) => {
      // Basic domain validation (at least one dot after @)
      const domain = email.split("@")[1];
      return domain?.includes(".");
    },
    { message: "Please enter a valid email domain" },
  );

export const waitlistSchema = toTypedSchema(
  z.object({
    email: emailSchema,
  }),
);

export const sendUniqueCodeSchema = toTypedSchema(
  z.object({
    email: emailSchema,
  }),
);

export const onboardingProfileSchema = toTypedSchema(
  z.object({
    first_name: z
      .string({
        error: "First name is required!",
      })
      .min(1, {
        message: "First name is required!",
      }),
    last_name: z
      .string({
        error: "Last name is required!",
      })
      .min(1, {
        message: "Last name is required!",
      }),
  }),
);

export const onboardingWorkspaceSchema = toTypedSchema(
  z.object({
    name: z
      .string({
        error: "Name is required!",
      })
      .min(1, "Name is required!"),
  }),
);

export const signinFormSchema = toTypedSchema(
  z.object({
    code: z
      .string({
        error: "Please enter the code sent to your email",
      })
      .length(8, {
        message: "Code must be exactly 8 characters.",
      }),
  }),
);

export const twoFactorSetupSchema = toTypedSchema(
  z.object({
    code: z
      .array(z.coerce.string(), {
        error: "Please enter the code from your authenticator app",
      })
      .length(6, {
        message: "Code shouldn't be less than 6 characters",
      }),
  }),
);

export const registerSecurityKeysSchema = toTypedSchema(
  z.object({
    name: z
      .string({
        error: "Name is required!",
      })
      .max(32, {
        message: "Maximum name length 32 chars!",
      })
      .min(3, {
        message: "Minimum name length 3 chars!",
      }),
  }),
);

export const newProjectSchema = toTypedSchema(
  z.object({
    title: z
      .string({
        error: "Title is required!",
      })
      .max(100, { message: "Title must be at most 100 characters long." }),
    status: z.string({
      error: "Status is required!",
    }),
    priority: z.string({
      error: "Priority is required!",
    }),
    description: z.string().optional(),
    dueDate: z.string().optional(),
  }),
);

export const newTaskSchema = toTypedSchema(
  z.object({
    name: z
      .string({
        error: "Name is required!",
      })
      .max(100, { message: "Name must be at most 100 characters long." }),
    status: z.string({
      error: "Status is required!",
    }),
    priority: z.string({
      error: "Priority is required!",
    }),
    description: z.string().optional(),
    dueDate: z.string().optional(),
  }),
);

export const columns = ref<IProjectColumn[]>([
  {
    name: "Idea",
    description: "Raw thoughts or concepts not yet acted upon.",
    icon: "hugeicons:ai-idea",
  },
  {
    name: "Todo",
    description: "Planned projects that are queued and ready to start.",
    icon: "solar:clipboard-outline",
  },
  {
    name: "In Progress",
    description: "Projects currently being worked on.",
    icon: "solar:alarm-outline",
  },
  {
    name: "In Review",
    description: "Projects completed but pending evaluation or feedback.",
    icon: "solar:minimalistic-magnifer-bug-outline",
  },
  {
    name: "Completed",
    description: "Projects fully done and verified.",
    icon: "solar:check-circle-outline",
  },
  {
    name: "Abandoned",
    description: "Projects intentionally discontinued or no longer relevant.",
    icon: "solar:trash-bin-trash-outline",
  },
]);

export const taskColumns = ref<IProjectColumn[]>([
  {
    name: "Idea",
    description: "Raw thoughts or concepts not yet acted upon.",
    icon: "hugeicons:ai-idea",
  },
  {
    name: "Todo",
    description: "Planned tasks that are queued and ready to start.",
    icon: "solar:clipboard-outline",
  },
  {
    name: "In Progress",
    description: "Tasks currently being worked on.",
    icon: "solar:alarm-outline",
  },
  {
    name: "In Review",
    description: "Tasks completed but pending evaluation or feedback.",
    icon: "solar:minimalistic-magnifer-bug-outline",
  },
  {
    name: "Completed",
    description: "Tasks fully done and verified.",
    icon: "solar:check-circle-outline",
  },
  {
    name: "Abandoned",
    description: "Tasks intentionally discontinued or no longer relevant.",
    icon: "solar:trash-bin-trash-outline",
  },
]);

export const roles = [
  {
    value: "owner",
    label: "Owner",
    icon: h(QuestionMarkCircledIcon),
  },
  {
    value: "moderator",
    label: "Moderator",
    icon: h(QuestionMarkCircledIcon),
  },
  {
    value: "member",
    label: "Member",
    icon: h(QuestionMarkCircledIcon),
  },
];

export const status = [
  {
    value: "PENDING",
    label: "Pending",
    icon: h(QuestionMarkCircledIcon),
  },
  {
    value: "CANCELED",
    label: "Canceled",
    icon: h(QuestionMarkCircledIcon),
  },
];

export const auth2fas = [
  {
    value: "enabled",
    label: "Enabled",
    icon: h(QuestionMarkCircledIcon),
  },
  {
    value: "disabled",
    label: "Disabled",
    icon: h(QuestionMarkCircledIcon),
  },
];
