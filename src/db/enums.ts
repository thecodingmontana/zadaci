import { pgEnum } from "drizzle-orm/pg-core";

export function enumToPgEnum<T extends Record<string, string>>(
	myEnum: T,
): [T[keyof T], ...T[keyof T][]] {
	return Object.values(myEnum) as [T[keyof T], ...T[keyof T][]];
}

export enum USER_ROLE {
	OWNER = "owner",
	MODERATOR = "moderator",
	MEMBER = "member",
	// only sees projects they're added to (see src/lib/permissions.ts)
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

// project health, as in the reference app (Planning, In Progress, At Risk, On Hold, Completed)
export enum PROJECT_STATUS {
	PLANNING = "planning",
	ACTIVE = "active",
	RISK = "risk",
	HOLD = "hold",
	COMPLETE = "complete",
}

export enum PRIORITY {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	NONE = "none",
	URGENT = "urgent",
}

export enum USER_STATUS {
	AVAILABLE = "available",
	BUSY = "busy",
	AWAY = "away",
	DO_NOT_DISTURB = "dnd",
	OFFLINE = "offline",
}

export const user_role_enum = pgEnum("user_role", enumToPgEnum(USER_ROLE));
export const status_enum = pgEnum("status", enumToPgEnum(STATUS));
export const priority_enum = pgEnum("priority", enumToPgEnum(PRIORITY));
export const project_status_enum = pgEnum(
	"project_status",
	enumToPgEnum(PROJECT_STATUS),
);
export const user_status_enum = pgEnum(
	"user_status",
	enumToPgEnum(USER_STATUS),
);
