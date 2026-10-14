import {
	boolean,
	index,
	integer,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { USER_STATUS, user_status_enum } from "./enums";
import { generateNanoId, pgTable, timestamps } from "./utils";

// Auth tables follow better-auth's field names (generated via `@better-auth/cli generate`).
const authTimestamps = {
	createdAt: timestamp("created_at", {
		mode: "date",
		precision: 3,
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", {
		mode: "date",
		precision: 3,
		withTimezone: true,
	})
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => new Date()),
};

export const user = pgTable("user", {
	id: varchar("id", { length: 16 })
		.primaryKey()
		.$defaultFn(() => generateNanoId()),
	name: text("name").notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	twoFactorEnabled: boolean("two_factor_enabled").default(false),
	whatsNewLastSeenVersion: varchar("whats_new_last_seen_version", {
		length: 20,
	}),
	...authTimestamps,
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		...authTimestamps,
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		...authTimestamps,
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		...authTimestamps,
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const twoFactor = pgTable(
	"two_factor",
	{
		id: text("id").primaryKey(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		verified: boolean("verified").default(true),
		failedVerificationCount: integer("failed_verification_count").default(0),
		lockedUntil: timestamp("locked_until", { withTimezone: true }),
	},
	(table) => [
		index("two_factor_secret_idx").on(table.secret),
		index("two_factor_user_id_idx").on(table.userId),
	],
);

export const passkey = pgTable(
	"passkey",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		deviceType: text("device_type").notNull(),
		backedUp: boolean("backed_up").notNull(),
		transports: text("transports"),
		aaguid: text("aaguid"),
		createdAt: timestamp("created_at", { withTimezone: true }),
	},
	(table) => [
		index("passkey_user_id_idx").on(table.userId),
		index("passkey_credential_id_idx").on(table.credentialID),
	],
);

export const user_status = pgTable("user_status", {
	id: varchar("id", { length: 16 })
		.primaryKey()
		.$defaultFn(() => generateNanoId()),
	user_id: varchar("user_id", { length: 16 })
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: "cascade" }),
	status: user_status_enum("status").notNull().default(USER_STATUS.AVAILABLE),
	custom_message: text("custom_message"), // e.g. "In a meeting"
	// null means the status persists until manually changed
	status_expires_at: timestamp("status_expires_at", {
		mode: "date",
		precision: 3,
		withTimezone: true,
	}),
	...timestamps,
});
