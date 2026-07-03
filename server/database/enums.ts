import { pgEnum } from "drizzle-orm/pg-core";

export function enumToPgEnum<T extends Record<string, string>>(
  myEnum: T
): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum) as [T[keyof T], ...T[keyof T][]];
}

export enum USER_ROLE {
  OWNER = "owner",
  MEMBER = "member",
  GUEST = "guest",
}

export enum STATUS {
  IDEA = "idea",
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  IN_REVIEW = "in_review",
  COMPLETED = "completed",
  ABANDONED = "abandoned",
}

export enum PRIORITY {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  NONE = "none",
  URGENT = "urgent",
}

export const user_role_enum = pgEnum("user_role", enumToPgEnum(USER_ROLE));
export const status_enum = pgEnum("status", enumToPgEnum(STATUS));
export const priority_enum = pgEnum("priority", enumToPgEnum(PRIORITY));
